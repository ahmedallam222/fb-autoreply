import Stripe from 'stripe';
import type { Plan, Tenant } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from './prisma.js';
import { logger } from '../config/logger.js';

/**
 * Plan limits — the source of truth for what each tier is allowed to do.
 *
 * `replyLimit` and `pageLimit` use -1 to mean "unlimited". All values come
 * from env vars so an operator can adjust them without a code change.
 *
 * Reply quotas reset on the first of each calendar month (UTC). We
 * intentionally don't tie the reset to the Stripe billing cycle for v1 —
 * a calendar month is simpler to reason about and good enough.
 */
export interface PlanLimits {
  replyLimit: number;
  pageLimit: number;
  priceUsd: number;
  /** Stripe Price ID, populated for paid plans only. */
  stripePriceId: string;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  FREE: {
    replyLimit: env.PLAN_FREE_REPLY_LIMIT,
    pageLimit: env.PLAN_FREE_PAGE_LIMIT,
    priceUsd: 0,
    stripePriceId: '',
  },
  PRO: {
    replyLimit: env.PLAN_PRO_REPLY_LIMIT,
    pageLimit: env.PLAN_PRO_PAGE_LIMIT,
    priceUsd: env.PLAN_PRO_PRICE_USD,
    stripePriceId: env.STRIPE_PRICE_ID_PRO,
  },
  BUSINESS: {
    replyLimit: env.PLAN_BUSINESS_REPLY_LIMIT,
    pageLimit: env.PLAN_BUSINESS_PAGE_LIMIT,
    priceUsd: env.PLAN_BUSINESS_PRICE_USD,
    stripePriceId: env.STRIPE_PRICE_ID_BUSINESS,
  },
};

export function isUnlimited(limit: number): boolean {
  return limit < 0;
}

/** Statuses we treat as "the customer is paid up". */
const ACTIVE_STRIPE_STATUSES = new Set(['trialing', 'active']);

/**
 * Effective plan for limit-enforcement: if the tenant is on PRO/BUSINESS
 * but the subscription has lapsed, we behave like FREE until they
 * resubscribe. If the subscription is unset (e.g. brand new tenant) we
 * trust the `plan` column (default FREE).
 */
export function effectivePlan(
  tenant: Pick<Tenant, 'plan' | 'subscriptionStatus' | 'stripeSubscriptionId'>,
): Plan {
  if (tenant.plan === 'FREE') return 'FREE';
  if (!tenant.stripeSubscriptionId) return 'FREE';
  if (!tenant.subscriptionStatus) return 'FREE';
  if (!ACTIVE_STRIPE_STATUSES.has(tenant.subscriptionStatus)) return 'FREE';
  return tenant.plan;
}

/** First-of-this-month at 00:00 UTC. */
export function startOfMonthUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Count outbound replies that actually went out this calendar month for
 * the tenant. We exclude error rows so a failed Graph call doesn't burn
 * the customer's quota.
 */
export async function countMonthlyReplies(tenantId: string, now: Date = new Date()): Promise<number> {
  const since = startOfMonthUtc(now);
  return prisma.replyEvent.count({
    where: {
      direction: 'OUTBOUND',
      errorMessage: null,
      createdAt: { gte: since },
      conversation: { tenantId },
    },
  });
}

export interface UsageInfo {
  plan: Plan;
  effectivePlan: Plan;
  subscriptionStatus: string | null;
  subscriptionCurrentPeriodEnd: string | null;
  limits: PlanLimits;
  usage: {
    repliesThisMonth: number;
    connectedPages: number;
  };
}

export async function getUsageInfo(tenantId: string): Promise<UsageInfo | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      plan: true,
      subscriptionStatus: true,
      subscriptionCurrentPeriodEnd: true,
      stripeSubscriptionId: true,
    },
  });
  if (!tenant) return null;
  const eff = effectivePlan(tenant);
  const [repliesThisMonth, connectedPages] = await Promise.all([
    countMonthlyReplies(tenantId),
    prisma.facebookPage.count({ where: { tenantId } }),
  ]);
  return {
    plan: tenant.plan,
    effectivePlan: eff,
    subscriptionStatus: tenant.subscriptionStatus,
    subscriptionCurrentPeriodEnd: tenant.subscriptionCurrentPeriodEnd?.toISOString() ?? null,
    limits: PLAN_LIMITS[eff],
    usage: { repliesThisMonth, connectedPages },
  };
}

/**
 * Cheap pre-flight check used by the auto-reply service. Returns false if
 * the tenant has hit (or exceeded) their monthly reply quota. Pages limit
 * is enforced separately in the page-connect routes.
 *
 * Note: this is racy under high concurrency (two webhook events arriving at
 * the same millisecond can both see "199" and both pass), but for v1 a small
 * over-count by a handful of replies is acceptable. Strict accounting would
 * require a counter row + UPDATE…RETURNING.
 */
export async function canSendReply(tenantId: string): Promise<{ ok: true } | { ok: false; reason: 'plan_reply_limit_reached'; plan: Plan }> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true, subscriptionStatus: true, stripeSubscriptionId: true },
  });
  if (!tenant) return { ok: false, reason: 'plan_reply_limit_reached', plan: 'FREE' };
  const eff = effectivePlan(tenant);
  const limits = PLAN_LIMITS[eff];
  if (isUnlimited(limits.replyLimit)) return { ok: true };
  const used = await countMonthlyReplies(tenantId);
  if (used >= limits.replyLimit) {
    return { ok: false, reason: 'plan_reply_limit_reached', plan: eff };
  }
  return { ok: true };
}

/**
 * Same shape as canSendReply but for page-connect routes. Counts include
 * the page about to be created so the caller can compare against the limit.
 */
export async function canConnectAnotherPage(tenantId: string): Promise<{ ok: true } | { ok: false; reason: 'plan_page_limit_reached'; plan: Plan; limit: number }> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true, subscriptionStatus: true, stripeSubscriptionId: true },
  });
  if (!tenant) return { ok: false, reason: 'plan_page_limit_reached', plan: 'FREE', limit: 0 };
  const eff = effectivePlan(tenant);
  const limits = PLAN_LIMITS[eff];
  if (isUnlimited(limits.pageLimit)) return { ok: true };
  const current = await prisma.facebookPage.count({ where: { tenantId } });
  if (current >= limits.pageLimit) {
    return { ok: false, reason: 'plan_page_limit_reached', plan: eff, limit: limits.pageLimit };
  }
  return { ok: true };
}

// ────────────────────────────────────────────────────────────────────────
// Stripe client (lazy, optional).
// ────────────────────────────────────────────────────────────────────────

let _stripe: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured (STRIPE_SECRET_KEY is empty)');
  }
  if (!_stripe) {
    _stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      // Pin to a version so a Stripe SDK upgrade doesn't silently change
      // webhook payload shapes. Update intentionally with a code review.
      apiVersion: '2025-01-27.acacia' as Stripe.LatestApiVersion,
    });
  }
  return _stripe;
}

/**
 * Returns the Stripe customer ID for the tenant, creating one on Stripe
 * the first time. The customer's email is the OWNER's email so receipts
 * and dunning emails go to a real person.
 */
export async function getOrCreateStripeCustomer(tenantId: string): Promise<string> {
  const stripe = getStripe();
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, stripeCustomerId: true },
  });
  if (!tenant) throw new Error(`tenant_not_found:${tenantId}`);
  if (tenant.stripeCustomerId) return tenant.stripeCustomerId;

  const owner = await prisma.user.findFirst({
    where: { tenantId, role: 'OWNER' },
    orderBy: { createdAt: 'asc' },
    select: { email: true, name: true },
  });

  const customer = await stripe.customers.create({
    name: tenant.name,
    email: owner?.email,
    metadata: { tenantId: tenant.id },
  });

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

export function getStripePriceForPlan(plan: Plan): string {
  if (plan === 'FREE') {
    throw new Error('FREE plan has no Stripe price');
  }
  const priceId = PLAN_LIMITS[plan].stripePriceId;
  if (!priceId) {
    throw new Error(`Stripe price ID not configured for plan ${plan}`);
  }
  return priceId;
}

/**
 * Map a Stripe Price ID back to our Plan enum. Used by the webhook handler
 * to figure out which tier the customer is on after a `customer.subscription.*`
 * event.
 */
export function planForStripePriceId(priceId: string | null | undefined): Plan {
  if (!priceId) return 'FREE';
  if (priceId === env.STRIPE_PRICE_ID_PRO) return 'PRO';
  if (priceId === env.STRIPE_PRICE_ID_BUSINESS) return 'BUSINESS';
  logger.warn({ priceId }, 'unknown_stripe_price_id_in_webhook');
  return 'FREE';
}

/**
 * Apply a Stripe Subscription to our Tenant row. Idempotent — safe to call
 * from webhook handlers that may receive the same event multiple times.
 *
 * If the subscription is in a non-active state (canceled, unpaid, …) we
 * keep the row but downgrade the effective plan via `effectivePlan()`.
 */
export async function applyStripeSubscription(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const tenant = await prisma.tenant.findUnique({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  if (!tenant) {
    logger.warn({ customerId, subId: sub.id }, 'stripe_webhook_unknown_customer');
    return;
  }
  // Subscription items can be empty if the sub was just created via the API
  // without a price; in our flow Checkout always sets one.
  const priceId = sub.items.data[0]?.price?.id;
  const plan = planForStripePriceId(priceId);
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      plan,
      stripeSubscriptionId: sub.id,
      subscriptionStatus: sub.status,
      subscriptionCurrentPeriodEnd: periodEnd,
    },
  });
  logger.info(
    { tenantId: tenant.id, plan, status: sub.status, subId: sub.id },
    'stripe_subscription_applied',
  );
}

/** Customer cancelled / Stripe deleted the subscription — drop them to FREE. */
export async function clearTenantSubscription(customerId: string): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  if (!tenant) return;
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      plan: 'FREE',
      stripeSubscriptionId: null,
      subscriptionStatus: 'canceled',
      subscriptionCurrentPeriodEnd: null,
    },
  });
  logger.info({ tenantId: tenant.id }, 'stripe_subscription_cleared');
}
