import express from 'express';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { webhookRouter } from './routes/webhook.js';
import { authRouter } from './routes/auth.js';
import { pagesRouter } from './routes/pages.js';
import { rulesRouter } from './routes/rules.js';
import { aiRouter } from './routes/ai.js';
import { conversationsRouter } from './routes/conversations.js';
import { analyticsRouter } from './routes/analytics.js';

const app = express();

// When deployed behind a load balancer / reverse proxy (Railway, Render,
// fly.io, nginx) we need to honour X-Forwarded-For so rate limiters see
// the real client IP. Set to 1 hop by default; override with
// `app.set('trust proxy', N)` if you have a longer chain.
app.set('trust proxy', 1);

app.use(
  cors({
    origin: env.PUBLIC_WEB_URL.split(',').map((s) => s.trim()),
    credentials: true,
  }),
);
app.use(pinoHttp({ logger }));

// Webhook router consumes its own raw-body parser so it must come BEFORE
// the global JSON parser. Webhooks are signature-verified, never rate-limited.
app.use('/api/webhooks', webhookRouter);

app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'fb-autoreply-api', ts: new Date().toISOString() });
});

// Strict per-IP limit on auth endpoints to slow down credential stuffing.
const authLimiter = rateLimit({
  windowMs: 60_000,
  limit: env.AUTH_RATE_LIMIT_PER_MIN,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'rate_limited' },
});
// Looser global limit to protect everything else.
const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: env.API_RATE_LIMIT_PER_MIN,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'rate_limited' },
});

app.use('/api/auth', authLimiter, authRouter);
app.use('/api/pages', apiLimiter, pagesRouter);
app.use('/api/rules', apiLimiter, rulesRouter);
app.use('/api/ai', apiLimiter, aiRouter);
app.use('/api/conversations', apiLimiter, conversationsRouter);
app.use('/api/analytics', apiLimiter, analyticsRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'not_found', path: req.path });
});

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'api_listening');
});
