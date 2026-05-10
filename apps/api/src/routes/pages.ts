import { Router, type Request, type Response } from 'express';
import { pageConnectInputSchema } from '@fb-autoreply/shared';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../lib/auth.js';
import {
  exchangeCodeForUserToken,
  exchangeForLongLivedUserToken,
  getUserPages,
  subscribePageWebhooks,
} from '../lib/facebook.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export const pagesRouter = Router();

pagesRouter.use(requireAuth);

/** List pages connected to the current tenant. */
pagesRouter.get('/', async (req: Request, res: Response) => {
  const pages = await prisma.facebookPage.findMany({
    where: { tenantId: req.auth!.tid },
    orderBy: { connectedAt: 'desc' },
  });
  res.json({
    pages: pages.map((p) => ({
      id: p.id,
      fbPageId: p.fbPageId,
      name: p.name,
      category: p.category,
      pictureUrl: p.pictureUrl,
      webhookSubscribed: p.webhookSubscribed,
      connectedAt: p.connectedAt,
    })),
  });
});

/**
 * Manual page connect — useful in development before App Review unlocks
 * the OAuth flow. Pass the pageId, name, and a long-lived page access token
 * obtained via the Graph API Explorer.
 */
pagesRouter.post('/manual', async (req: Request, res: Response) => {
  const parsed = pageConnectInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }
  const { pageId, pageName, pageAccessToken } = parsed.data;

  let webhookSubscribed = false;
  try {
    const r = await subscribePageWebhooks(pageId, pageAccessToken);
    webhookSubscribed = !!r.success;
  } catch (err) {
    logger.warn({ err }, 'webhook_subscribe_failed_during_manual_connect');
  }

  const page = await prisma.facebookPage.upsert({
    where: { fbPageId: pageId },
    create: {
      tenantId: req.auth!.tid,
      fbPageId: pageId,
      name: pageName,
      pageAccessToken,
      webhookSubscribed,
    },
    update: {
      tenantId: req.auth!.tid,
      name: pageName,
      pageAccessToken,
      webhookSubscribed,
    },
  });

  res.status(201).json({ page: { id: page.id, fbPageId: page.fbPageId, name: page.name } });
});

/** Begin Facebook OAuth — returns the URL for the user to visit. */
pagesRouter.get('/oauth/url', (_req: Request, res: Response) => {
  if (!env.FB_APP_ID) {
    res.status(503).json({ error: 'fb_app_not_configured' });
    return;
  }
  const redirect = env.FB_OAUTH_REDIRECT_URI ?? `${env.PUBLIC_API_URL}/api/pages/oauth/callback`;
  const url = new URL(`https://www.facebook.com/${env.FB_API_VERSION}/dialog/oauth`);
  url.searchParams.set('client_id', env.FB_APP_ID);
  url.searchParams.set('redirect_uri', redirect);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set(
    'scope',
    'pages_show_list,pages_messaging,pages_manage_engagement,pages_read_engagement,pages_manage_metadata',
  );
  res.json({ url: url.toString() });
});

/**
 * OAuth callback — exchanges the code for a long-lived token, fetches
 * the user's pages, and connects them all to the current tenant.
 *
 * For the MVP this is a synchronous redirect-based flow. For production
 * we'd want a `state` param tied to the user's session.
 */
pagesRouter.get('/oauth/callback', async (req: Request, res: Response) => {
  const code = typeof req.query.code === 'string' ? req.query.code : null;
  if (!code) {
    res.status(400).json({ error: 'missing_code' });
    return;
  }
  const redirect = env.FB_OAUTH_REDIRECT_URI ?? `${env.PUBLIC_API_URL}/api/pages/oauth/callback`;

  try {
    const short = await exchangeCodeForUserToken(code, redirect);
    const long = await exchangeForLongLivedUserToken(short.access_token);
    const pages = await getUserPages(long.access_token);

    let connected = 0;
    for (const p of pages) {
      let webhookSubscribed = false;
      try {
        const r = await subscribePageWebhooks(p.id, p.access_token);
        webhookSubscribed = !!r.success;
      } catch (err) {
        logger.warn({ err, pageId: p.id }, 'webhook_subscribe_failed');
      }
      await prisma.facebookPage.upsert({
        where: { fbPageId: p.id },
        create: {
          tenantId: req.auth!.tid,
          fbPageId: p.id,
          name: p.name,
          category: p.category,
          pageAccessToken: p.access_token,
          webhookSubscribed,
        },
        update: {
          tenantId: req.auth!.tid,
          name: p.name,
          category: p.category,
          pageAccessToken: p.access_token,
          webhookSubscribed,
        },
      });
      connected += 1;
    }
    res.redirect(`${env.PUBLIC_WEB_URL}/dashboard/pages?connected=${connected}`);
  } catch (err) {
    logger.error({ err }, 'oauth_callback_failed');
    res.status(500).json({ error: 'oauth_failed', message: (err as Error).message });
  }
});

pagesRouter.delete('/:id', async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ error: 'missing_id' });
    return;
  }
  const page = await prisma.facebookPage.findFirst({
    where: { id, tenantId: req.auth!.tid },
  });
  if (!page) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  await prisma.facebookPage.delete({ where: { id: page.id } });
  res.status(204).end();
});
