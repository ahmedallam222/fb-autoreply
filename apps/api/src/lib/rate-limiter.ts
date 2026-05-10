import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

/**
 * Simple in-process token bucket. Used to throttle **outbound** Graph API
 * replies per tenant so a runaway tenant can't get our app blocked by Meta.
 *
 * For multi-instance deployments this should be replaced with Redis (BullMQ
 * or rate-limiter-flexible). For an MVP single instance, in-memory is fine.
 */
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSec: number,
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    if (elapsed > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSec);
      this.lastRefill = now;
    }
  }

  tryAcquire(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  /** Time in ms until at least one token will be available. */
  msUntilNextToken(): number {
    this.refill();
    if (this.tokens >= 1) return 0;
    return Math.ceil(((1 - this.tokens) * 1000) / this.refillPerSec);
  }
}

const buckets = new Map<string, TokenBucket>();

function getBucket(key: string): TokenBucket {
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = new TokenBucket(env.OUTBOUND_RATE_BURST, env.OUTBOUND_RATE_PER_SECOND);
    buckets.set(key, bucket);
  }
  return bucket;
}

/**
 * Try to acquire a slot to send an outbound reply for `tenantId`. If the
 * bucket is empty we wait up to `maxWaitMs` for a token to refill, then give
 * up and return false. Callers should record the dropped reply as an error.
 */
export async function acquireOutboundSlot(
  tenantId: string,
  maxWaitMs = 30_000,
): Promise<boolean> {
  const bucket = getBucket(tenantId);
  const start = Date.now();
  // Loop with bounded backoff. We never block longer than maxWaitMs.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (bucket.tryAcquire()) return true;
    const wait = bucket.msUntilNextToken();
    if (Date.now() - start + wait > maxWaitMs) {
      logger.warn({ tenantId }, 'outbound_rate_limited');
      return false;
    }
    await new Promise((r) => setTimeout(r, Math.min(wait, 250)));
  }
}

/** Test-only: clear all buckets so unit tests don't leak state. */
export function _resetBucketsForTests(): void {
  buckets.clear();
}
