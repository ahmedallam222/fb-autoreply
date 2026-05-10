import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Tenant } from '@prisma/client';
import { effectivePlan, isUnlimited, planForStripePriceId, startOfMonthUtc } from './billing.js';

type SubFields = Pick<Tenant, 'plan' | 'subscriptionStatus' | 'stripeSubscriptionId'>;
const t = (overrides: Partial<SubFields>): SubFields => ({
  plan: 'FREE',
  subscriptionStatus: null,
  stripeSubscriptionId: null,
  ...overrides,
});

test('isUnlimited: -1 means unlimited; 0 and positive numbers are bounded', () => {
  assert.equal(isUnlimited(-1), true);
  assert.equal(isUnlimited(0), false);
  assert.equal(isUnlimited(1), false);
  assert.equal(isUnlimited(1_000_000), false);
});

test('effectivePlan: FREE tenant stays FREE regardless of Stripe state', () => {
  assert.equal(effectivePlan(t({ plan: 'FREE' })), 'FREE');
  assert.equal(
    effectivePlan(t({ plan: 'FREE', subscriptionStatus: 'active', stripeSubscriptionId: 'sub_x' })),
    'FREE',
  );
});

test('effectivePlan: PRO with no subscription downgrades to FREE', () => {
  // Tenant.plan was set to PRO via webhook but the subscription was never
  // attached (or was deleted). Without an active sub we should never grant
  // PRO entitlements.
  assert.equal(effectivePlan(t({ plan: 'PRO' })), 'FREE');
  assert.equal(
    effectivePlan(t({ plan: 'PRO', stripeSubscriptionId: 'sub_x', subscriptionStatus: null })),
    'FREE',
  );
});

test('effectivePlan: PRO with cancelled subscription downgrades to FREE', () => {
  for (const status of ['canceled', 'incomplete', 'incomplete_expired', 'past_due', 'unpaid']) {
    assert.equal(
      effectivePlan(t({ plan: 'PRO', stripeSubscriptionId: 'sub_x', subscriptionStatus: status })),
      'FREE',
      `status ${status} should downgrade PRO to FREE`,
    );
  }
});

test('effectivePlan: PRO with active or trialing subscription stays PRO', () => {
  for (const status of ['active', 'trialing']) {
    assert.equal(
      effectivePlan(t({ plan: 'PRO', stripeSubscriptionId: 'sub_x', subscriptionStatus: status })),
      'PRO',
      `status ${status} should keep PRO`,
    );
  }
});

test('effectivePlan: BUSINESS with active subscription stays BUSINESS', () => {
  assert.equal(
    effectivePlan(
      t({ plan: 'BUSINESS', stripeSubscriptionId: 'sub_x', subscriptionStatus: 'active' }),
    ),
    'BUSINESS',
  );
});

test('startOfMonthUtc: returns the first of the month at 00:00 UTC', () => {
  const mid = new Date('2025-03-15T13:45:23.111Z');
  const start = startOfMonthUtc(mid);
  assert.equal(start.toISOString(), '2025-03-01T00:00:00.000Z');
});

test('startOfMonthUtc: handles the first of a month correctly (idempotent)', () => {
  const start = startOfMonthUtc(new Date('2025-03-01T00:00:00.000Z'));
  assert.equal(start.toISOString(), '2025-03-01T00:00:00.000Z');
});

test('startOfMonthUtc: handles December → January boundary', () => {
  const last = new Date('2024-12-31T23:59:59.999Z');
  const start = startOfMonthUtc(last);
  assert.equal(start.toISOString(), '2024-12-01T00:00:00.000Z');
});

test('planForStripePriceId: returns FREE for unknown / missing IDs', () => {
  assert.equal(planForStripePriceId(undefined), 'FREE');
  assert.equal(planForStripePriceId(null), 'FREE');
  assert.equal(planForStripePriceId(''), 'FREE');
  assert.equal(planForStripePriceId('price_some_random_id'), 'FREE');
});

// Note: a second test that re-imports billing.js with mutated env vars
// would be ideal here, but `env` is parsed once at module load time via
// dotenv/zod, so the simplest verification of "configured IDs map back
// to plans" is the pre-submit acceptance test in
// docs/META_APP_REVIEW.md → reviewer test plan.
