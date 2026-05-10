import { Router, type Request, type Response } from 'express';
import express from 'express';
import type Stripe from 'stripe';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import {
  applyStripeSubscription,
  clearTenantSubscription,
  getStripe,
  isStripeConfigured,
} from '../lib/billing.js';

export const stripeWebhookRouter = Router();

/**
 * Stripe webhooks need the *raw* request body to verify the
 * `Stripe-Signature` header. We mount this router on its own path BEFORE
 * the global `express.json()` middleware in src/index.ts so this raw
 * parser is the one that runs.
 */
stripeWebhookRouter.post(
  '/',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    if (!isStripeConfigured() || !env.STRIPE_WEBHOOK_SECRET) {
      return res.status(503).json({ error: 'stripe_not_configured' });
    }
    const sig = req.headers['stripe-signature'];
    if (typeof sig !== 'string') {
      return res.status(400).json({ error: 'missing_signature' });
    }

    let event: Stripe.Event;
    try {
      event = getStripe().webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'stripe_webhook_signature_invalid');
      return res.status(400).json({ error: 'invalid_signature' });
    }

    // Always 200 quickly so Stripe doesn't retry. Do the work async-friendly
    // but await it within this request — our event volume is low.
    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          // The Subscription object is created at this point; we'll get the
          // subsequent `customer.subscription.created` event with full data,
          // but we can pre-attach the subscription ID here so the dashboard
          // shows "active" immediately rather than waiting for the next event.
          const session = event.data.object as Stripe.Checkout.Session;
          if (session.subscription && typeof session.subscription === 'string') {
            const sub = await getStripe().subscriptions.retrieve(session.subscription);
            await applyStripeSubscription(sub);
          }
          break;
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.resumed':
        case 'customer.subscription.paused': {
          await applyStripeSubscription(event.data.object as Stripe.Subscription);
          break;
        }
        case 'customer.subscription.deleted': {
          const sub = event.data.object as Stripe.Subscription;
          const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
          await clearTenantSubscription(customerId);
          break;
        }
        default:
          logger.debug({ type: event.type }, 'stripe_webhook_ignored');
      }
    } catch (err) {
      logger.error({ err: (err as Error).message, type: event.type }, 'stripe_webhook_handler_failed');
      // Still 200 — we don't want Stripe to retry on a code bug. The error
      // is in our logs and we can replay manually if needed.
    }

    res.json({ received: true });
  },
);
