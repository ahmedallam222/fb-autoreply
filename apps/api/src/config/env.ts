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

  // Email notifications. If SMTP_HOST is empty the mailer is a no-op (only
  // logs what it would have sent). All four SMTP_* vars are required to
  // actually send.
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_FROM: z.string().optional().default('fb-autoreply <noreply@example.com>'),

  // When false, the in-process notification scheduler does NOT start. Use
  // this on read-replica / web-only / Lambda deployments. Defaults to true,
  // but if you ever scale to >1 instance you MUST set this to false on all
  // but one instance to avoid duplicate emails.
  NOTIFICATIONS_SCHEDULER_ENABLED: z.coerce.boolean().default(true),

  // Stripe billing. All optional — if STRIPE_SECRET_KEY is empty the billing
  // routes return 503 and the auto-reply pipeline does NOT enforce limits
  // (so local dev keeps working without a Stripe account). Use Stripe's
  // test-mode keys (sk_test_…, whsec_…) in non-production environments.
  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
  // Price IDs for the Pro and Business tiers. Create these once in your
  // Stripe Dashboard → Products and paste the `price_…` IDs here.
  STRIPE_PRICE_ID_PRO: z.string().optional().default(''),
  STRIPE_PRICE_ID_BUSINESS: z.string().optional().default(''),

  // Plan limits. All positive integers. -1 means "unlimited".
  PLAN_FREE_REPLY_LIMIT: z.coerce.number().int().default(200),
  PLAN_FREE_PAGE_LIMIT: z.coerce.number().int().default(1),
  PLAN_PRO_REPLY_LIMIT: z.coerce.number().int().default(5_000),
  PLAN_PRO_PAGE_LIMIT: z.coerce.number().int().default(5),
  PLAN_BUSINESS_REPLY_LIMIT: z.coerce.number().int().default(-1),
  PLAN_BUSINESS_PAGE_LIMIT: z.coerce.number().int().default(-1),

  // Display-only USD prices, shown in the dashboard's pricing UI. The
  // authoritative price lives in Stripe — these are just for the upgrade card.
  PLAN_PRO_PRICE_USD: z.coerce.number().int().default(19),
  PLAN_BUSINESS_PRICE_USD: z.coerce.number().int().default(49),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
