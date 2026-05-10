import { Router, type Request, type Response } from 'express';
import express from 'express';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { prisma } from '../lib/prisma.js';
import { verifyWebhookSignature } from '../lib/facebook.js';
import { processInboundEvent } from '../services/auto-reply.js';
import type { FacebookWebhookPayload } from '@fb-autoreply/shared';

export const webhookRouter = Router();

// Capture the raw body for signature verification while still parsing JSON.
const rawJson = express.json({
  verify: (req: Request, _res: Response, buf: Buffer) => {
    (req as Request & { rawBody?: Buffer }).rawBody = buf;
  },
});

/**
 * GET — Meta sends a verification challenge once, when you register the
 * webhook URL in the App dashboard.
 *   https://developers.facebook.com/docs/graph-api/webhooks/getting-started
 */
webhookRouter.get('/facebook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === env.FB_VERIFY_TOKEN && typeof challenge === 'string') {
    logger.info('webhook_verified');
    res.status(200).send(challenge);
    return;
  }
  res.sendStatus(403);
});

/** POST — actual event delivery. */
webhookRouter.post('/facebook', rawJson, async (req: Request, res: Response) => {
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  const sig = req.header('x-hub-signature-256');
  if (!rawBody || !verifyWebhookSignature(rawBody, sig)) {
    logger.warn('webhook_signature_invalid');
    res.sendStatus(403);
    return;
  }

  // ACK immediately so Meta doesn't retry. Process events asynchronously.
  res.sendStatus(200);

  const body = req.body as FacebookWebhookPayload;
  if (body?.object !== 'page' || !Array.isArray(body.entry)) return;

  for (const entry of body.entry) {
    const fbPageId = entry.id;
    const page = await prisma.facebookPage.findUnique({ where: { fbPageId } });
    if (!page) {
      logger.debug({ fbPageId }, 'webhook_unknown_page');
      continue;
    }

    // Comments arrive in `changes`
    for (const change of entry.changes ?? []) {
      if (change.field !== 'feed') continue;
      const v = change.value;
      if (v.item !== 'comment' || v.verb !== 'add') continue;
      // Skip comments authored by the page itself to avoid reply loops.
      if (v.from?.id === fbPageId) continue;
      if (!v.comment_id || !v.message) continue;

      try {
        await processInboundEvent({
          tenantId: page.tenantId,
          pageDbId: page.id,
          pageAccessToken: page.pageAccessToken,
          channel: 'COMMENT',
          text: v.message,
          externalId: v.comment_id,
          customerName: v.from?.name ?? v.sender_name,
          customerHandle: v.from?.id ?? v.sender_id,
        });
      } catch (err) {
        logger.error({ err }, 'comment_processing_failed');
      }
    }

    // Messenger events arrive in `messaging`
    for (const m of entry.messaging ?? []) {
      if (!m.message?.text || m.message.is_echo) continue;
      if (m.sender.id === fbPageId) continue;

      try {
        await processInboundEvent({
          tenantId: page.tenantId,
          pageDbId: page.id,
          pageAccessToken: page.pageAccessToken,
          channel: 'MESSAGE',
          text: m.message.text,
          externalId: m.sender.id,
          customerHandle: m.sender.id,
        });
      } catch (err) {
        logger.error({ err }, 'message_processing_failed');
      }
    }
  }
});
