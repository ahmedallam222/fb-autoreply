import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TokenBucket } from './rate-limiter.js';

test('TokenBucket starts full and acquires up to capacity', () => {
  const b = new TokenBucket(3, 1);
  assert.equal(b.tryAcquire(), true);
  assert.equal(b.tryAcquire(), true);
  assert.equal(b.tryAcquire(), true);
  assert.equal(b.tryAcquire(), false);
});

test('TokenBucket refills at refillPerSec', async () => {
  // 10/s = one token every 100ms.
  const b = new TokenBucket(1, 10);
  assert.equal(b.tryAcquire(), true);
  assert.equal(b.tryAcquire(), false);
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(b.tryAcquire(), true);
});

test('msUntilNextToken returns 0 when tokens available', () => {
  const b = new TokenBucket(2, 1);
  assert.equal(b.msUntilNextToken(), 0);
  b.tryAcquire();
  assert.equal(b.msUntilNextToken(), 0);
});

test('msUntilNextToken estimates wait when empty', () => {
  // 1 token/s ⇒ ~1000ms wait when empty.
  const b = new TokenBucket(1, 1);
  b.tryAcquire();
  const wait = b.msUntilNextToken();
  assert.ok(wait > 0 && wait <= 1100, `expected ~1000ms, got ${wait}`);
});
