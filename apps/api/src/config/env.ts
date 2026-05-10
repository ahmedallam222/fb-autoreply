import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  PUBLIC_API_URL: z.string().url().default('http://localhost:4000'),
  PUBLIC_WEB_URL: z.string().url().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  FB_APP_ID: z.string().optional().default(''),
  FB_APP_SECRET: z.string().optional().default(''),
  FB_API_VERSION: z.string().default('v21.0'),
  FB_VERIFY_TOKEN: z.string().min(1, 'FB_VERIFY_TOKEN is required'),
  FB_OAUTH_REDIRECT_URI: z.string().url().optional(),

  OPENAI_API_KEY: z.string().optional().default(''),

  // 64 hex chars (32 bytes) for AES-256-GCM. Generate with `openssl rand -hex 32`.
  // Required in production; optional in dev to keep `npm run dev` low-friction.
  TOKEN_ENCRYPTION_KEY: z.string().optional().default(''),

  // Outbound reply rate limit (per tenant). 30 replies / 60s by default — Meta
  // generally allows higher but we stay conservative to avoid app-level blocks.
  OUTBOUND_RATE_BURST: z.coerce.number().int().positive().default(30),
  OUTBOUND_RATE_PER_SECOND: z.coerce.number().positive().default(0.5),

  // Auth endpoint rate limit (per IP).
  AUTH_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(10),
  // Global API rate limit (per IP). Webhook endpoint is excluded.
  API_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(300),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
