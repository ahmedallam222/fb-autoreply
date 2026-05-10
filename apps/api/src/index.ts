import express from 'express';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { webhookRouter } from './routes/webhook.js';
import { authRouter } from './routes/auth.js';
import { pagesRouter } from './routes/pages.js';
import { rulesRouter } from './routes/rules.js';
import { aiRouter } from './routes/ai.js';
import { conversationsRouter } from './routes/conversations.js';

const app = express();

app.use(
  cors({
    origin: env.PUBLIC_WEB_URL.split(',').map((s) => s.trim()),
    credentials: true,
  }),
);
app.use(pinoHttp({ logger }));

// Webhook router consumes its own raw-body parser so it must come BEFORE
// the global JSON parser.
app.use('/api/webhooks', webhookRouter);

app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'fb-autoreply-api', ts: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/pages', pagesRouter);
app.use('/api/rules', rulesRouter);
app.use('/api/ai', aiRouter);
app.use('/api/conversations', conversationsRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'not_found', path: req.path });
});

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'api_listening');
});
