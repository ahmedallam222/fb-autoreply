import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const GRAPH_BASE = () => `https://graph.facebook.com/${env.FB_API_VERSION}`;

/**
 * Verify the X-Hub-Signature-256 header sent by Facebook on every webhook
 * delivery. Returns true if the signature matches.
 */
export function verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  if (!signatureHeader || !env.FB_APP_SECRET) return false;
  const expected =
    'sha256=' +
    crypto.createHmac('sha256', env.FB_APP_SECRET).update(rawBody).digest('hex');

  // Constant-time compare
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

interface FbErrorBody {
  error?: { message?: string; type?: string; code?: number };
}

async function fbRequest<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  accessToken: string,
  body?: Record<string, unknown>,
  query?: Record<string, string>,
): Promise<T> {
  const url = new URL(`${GRAPH_BASE()}${path}`);
  url.searchParams.set('access_token', accessToken);
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);

  const res = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as FbErrorBody;
    const msg = data.error?.message ?? `Graph API ${res.status}`;
    logger.warn({ status: res.status, msg, path }, 'graph_api_error');
    throw new GraphApiError(msg, res.status, data.error?.code);
  }
  return (await res.json()) as T;
}

export class GraphApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: number,
  ) {
    super(message);
    this.name = 'GraphApiError';
  }
}

/** Reply to a Facebook comment. */
export async function replyToComment(
  commentId: string,
  message: string,
  pageAccessToken: string,
): Promise<{ id: string }> {
  return fbRequest<{ id: string }>('POST', `/${commentId}/comments`, pageAccessToken, {
    message,
  });
}

/** Send a Messenger message to a PSID using the standard messaging window. */
export async function sendMessengerMessage(
  recipientPsid: string,
  text: string,
  pageAccessToken: string,
): Promise<{ message_id: string; recipient_id: string }> {
  return fbRequest<{ message_id: string; recipient_id: string }>(
    'POST',
    `/me/messages`,
    pageAccessToken,
    {
      recipient: { id: recipientPsid },
      messaging_type: 'RESPONSE',
      message: { text },
    },
  );
}

/** Get the list of pages the user manages along with page tokens. */
export async function getUserPages(userAccessToken: string): Promise<
  Array<{ id: string; name: string; access_token: string; category?: string }>
> {
  const data = await fbRequest<{
    data: Array<{ id: string; name: string; access_token: string; category?: string }>;
  }>('GET', '/me/accounts', userAccessToken, undefined, {
    fields: 'id,name,access_token,category',
  });
  return data.data;
}

/** Subscribe a page to receive feed + messages webhooks. */
export async function subscribePageWebhooks(
  pageId: string,
  pageAccessToken: string,
): Promise<{ success: boolean }> {
  return fbRequest<{ success: boolean }>(
    'POST',
    `/${pageId}/subscribed_apps`,
    pageAccessToken,
    undefined,
    {
      subscribed_fields: 'feed,messages,messaging_postbacks',
    },
  );
}

/** Exchange a short-lived user token for a long-lived one. */
export async function exchangeForLongLivedUserToken(
  shortLivedToken: string,
): Promise<{ access_token: string; expires_in?: number }> {
  const url = new URL(`${GRAPH_BASE()}/oauth/access_token`);
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', env.FB_APP_ID);
  url.searchParams.set('client_secret', env.FB_APP_SECRET);
  url.searchParams.set('fb_exchange_token', shortLivedToken);
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new GraphApiError(`Token exchange failed: ${text}`, res.status);
  }
  return (await res.json()) as { access_token: string; expires_in?: number };
}

/** Exchange OAuth code for a short-lived user access token. */
export async function exchangeCodeForUserToken(
  code: string,
  redirectUri: string,
): Promise<{ access_token: string; expires_in?: number }> {
  const url = new URL(`${GRAPH_BASE()}/oauth/access_token`);
  url.searchParams.set('client_id', env.FB_APP_ID);
  url.searchParams.set('client_secret', env.FB_APP_SECRET);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('code', code);
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new GraphApiError(`OAuth code exchange failed: ${text}`, res.status);
  }
  return (await res.json()) as { access_token: string; expires_in?: number };
}
