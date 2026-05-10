import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import {
  PLAN_LIMITS,
  getOrCreateStripeCustomer,
  getStripe,
  getStripePriceForPlan,
  getUsageInfo,
  isStripeConfigured,
} from '../lib/billing.js';

export const billingRouter = Router();
billingRouter.use(requireAuth);

/**
 * Reads (the "what plan am I on?" endpoint) are open to any tenant member —
 * they show how much quota is left, which is useful for everyone. Writes
 * (start a checkout / open the customer portal) require OWNER or ADMIN.
 */
const writeGate = requireRole('OWNER', 'ADMIN');

billingRouter.get('/plan', async (req: Request, res: Response) => {
  const info = await getUsageInfo(req.auth!.tid);
  if (!info) return res.status(404).json({ error: 'tenant_not_found' });

  // Surface plan defaults so the dashboard can render the upgrade card
  // without re-fetching env-driven config from anywhere else.
  const tiers = (['FREE', 'PRO', 'BUSINESS'] as const).map((plan) => ({
    plan,
    priceUsd: PLAN_LIMITS[plan].priceUsd,
    replyLimit: PLAN_LIMITS[plan].replyLimit,
    pageLimit: PLAN_LIMITS[plan].pageLimit,
    available: plan === 'FREE' ? true : Boolean(PLAN_LIMITS[plan].stripePriceId),
  }));

  res.json({
    ...info,
    stripeConfigured: isStripeConfigured(),
    tiers,
  });
});

const checkoutSchema = z.object({
  plan: z.enum(['PRO', 'BUSINESS']),
  /** Where to send the user on success/cancel. The frontend passes
   * window.location.origin + the relevant routes. */
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

billingRouter.post('/checkout', writeGate, async (req: Request, res: Response) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({ error: 'stripe_not_configured' });
  }
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body', issues: parsed.error.flatten() });
  }
  const { plan, successUrl, cancelUrl } = parsed.data;

  let priceId: string;
  try {
    priceId = getStripePriceForPlan(plan);
  } catch (err) {
    logger.error({ err: (err as Error).message, plan }, 'checkout_no_price_id');
    return res.status(503).json({ error: 'plan_not_available', plan });
  }

  const customerId = await getOrCreateStripeCustomer(req.auth!.tid);
  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    // We use Stripe's hosted checkout in test mode by default; allow_promotion_codes
    // lets you experiment with discount codes without shipping a coupon UI.
    allow_promotion_codes: true,
    metadata: { tenantId: req.auth!.tid, plan },
    subscription_data: {
      metadata: { tenantId: req.auth!.tid, plan },
    },
  });

  res.json({ url: session.url });
});

const portalSchema = z.object({ returnUrl: z.string().url() });

billingRouter.post('/portal', writeGate, async (req: Request, res: Response) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({ error: 'stripe_not_configured' });
  }
  const parsed = portalSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body', issues: parsed.error.flatten() });
  }
  const customerId = await getOrCreateStripeCustomer(req.auth!.tid);
  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: parsed.data.returnUrl,
  });
  res.json({ url: session.url });
});

billingRouter.get('/_debug', async (_req, res) => {
  // Tiny helper for ops: did we wire up Stripe correctly?
  res.json({
    stripeConfigured: isStripeConfigured(),
    proPriceConfigured: Boolean(env.STRIPE_PRICE_ID_PRO),
    businessPriceConfigured: Boolean(env.STRIPE_PRICE_ID_BUSINESS),
    webhookSecretConfigured: Boolean(env.STRIPE_WEBHOOK_SECRET),
  });
});
