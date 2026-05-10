import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldFireErrorAlert,
  shouldSendDailyDigest,
  resolveRecipients,
  renderDailyDigestText,
  renderErrorAlertText,
  ERROR_ALERT_COOLDOWN_MS,
  DAILY_DIGEST_HOUR_UTC,
} from './notifications.js';

const NOW = new Date('2024-06-15T10:00:00Z');

/* -------- shouldFireErrorAlert -------- */

test('errorAlert: silent when disabled', () => {
  assert.equal(
    shouldFireErrorAlert({
      enabled: false,
      stats: { total: 100, errors: 100 },
      lastFiredAt: null,
      now: NOW,
    }),
    false,
  );
});

test('errorAlert: silent when traffic is below the floor', () => {
  // 5 replies, 5 errors — 100% rate but only 5 attempts → still silent.
  assert.equal(
    shouldFireErrorAlert({
      enabled: true,
      stats: { total: 5, errors: 5 },
      lastFiredAt: null,
      now: NOW,
    }),
    false,
  );
});

test('errorAlert: silent when below the rate threshold', () => {
  // 100 replies, 20% errors → below 30% threshold.
  assert.equal(
    shouldFireErrorAlert({
      enabled: true,
      stats: { total: 100, errors: 20 },
      lastFiredAt: null,
      now: NOW,
    }),
    false,
  );
});

test('errorAlert: fires on a real spike', () => {
  // 20 replies, 8 errors = 40% → above threshold.
  assert.equal(
    shouldFireErrorAlert({
      enabled: true,
      stats: { total: 20, errors: 8 },
      lastFiredAt: null,
      now: NOW,
    }),
    true,
  );
});

test('errorAlert: respects the 1h cooldown', () => {
  const justFired = new Date(NOW.getTime() - 30 * 60 * 1000);
  assert.equal(
    shouldFireErrorAlert({
      enabled: true,
      stats: { total: 50, errors: 25 },
      lastFiredAt: justFired,
      now: NOW,
    }),
    false,
  );
});

test('errorAlert: fires again once the cooldown has passed', () => {
  const longAgo = new Date(NOW.getTime() - ERROR_ALERT_COOLDOWN_MS - 1000);
  assert.equal(
    shouldFireErrorAlert({
      enabled: true,
      stats: { total: 50, errors: 25 },
      lastFiredAt: longAgo,
      now: NOW,
    }),
    true,
  );
});

/* -------- shouldSendDailyDigest -------- */

test('dailyDigest: silent when disabled', () => {
  assert.equal(
    shouldSendDailyDigest({ enabled: false, lastSentAt: null, now: NOW }),
    false,
  );
});

test('dailyDigest: only fires during the configured UTC hour', () => {
  const wrongHour = new Date('2024-06-15T11:00:00Z');
  assert.equal(
    shouldSendDailyDigest({ enabled: true, lastSentAt: null, now: wrongHour }),
    false,
  );
  const rightHour = new Date(`2024-06-15T${String(DAILY_DIGEST_HOUR_UTC).padStart(2, '0')}:30:00Z`);
  assert.equal(
    shouldSendDailyDigest({ enabled: true, lastSentAt: null, now: rightHour }),
    true,
  );
});

test('dailyDigest: skips a second tick on the same UTC day', () => {
  const at09 = new Date('2024-06-15T09:00:00Z');
  const at0905 = new Date('2024-06-15T09:05:00Z');
  // First tick should have just sent it.
  assert.equal(
    shouldSendDailyDigest({ enabled: true, lastSentAt: at09, now: at0905 }),
    false,
  );
});

test('dailyDigest: fires the next UTC day even if last send was yesterday', () => {
  const yesterday09 = new Date('2024-06-14T09:00:00Z');
  const today09 = new Date('2024-06-15T09:01:00Z');
  assert.equal(
    shouldSendDailyDigest({ enabled: true, lastSentAt: yesterday09, now: today09 }),
    true,
  );
});

/* -------- resolveRecipients -------- */

test('resolveRecipients: trims and splits override', () => {
  assert.deepEqual(
    resolveRecipients({
      recipientOverride: 'a@x.com, b@x.com,c@x.com',
      ownerEmails: ['owner@x.com'],
    }),
    ['a@x.com', 'b@x.com', 'c@x.com'],
  );
});

test('resolveRecipients: falls back to owner emails when override empty', () => {
  assert.deepEqual(
    resolveRecipients({ recipientOverride: '', ownerEmails: ['o1@x.com', 'o2@x.com'] }),
    ['o1@x.com', 'o2@x.com'],
  );
  assert.deepEqual(
    resolveRecipients({ recipientOverride: null, ownerEmails: ['o1@x.com'] }),
    ['o1@x.com'],
  );
});

/* -------- render functions sanity -------- */

test('renderDailyDigestText: contains all summary stats', () => {
  const text = renderDailyDigestText({
    tenantName: 'Acme',
    windowStart: new Date('2024-06-14T09:00:00Z'),
    windowEnd: new Date('2024-06-15T09:00:00Z'),
    inboundCount: 42,
    outboundSuccessCount: 38,
    outboundErrorCount: 4,
    topRules: [
      { name: 'pricing', count: 17 },
      { name: 'shipping', count: 9 },
    ],
    aiCostUsd: 0.0123,
  });
  assert.match(text, /Acme/);
  assert.match(text, /Inbound messages:\s+42/);
  assert.match(text, /Replies sent:\s+38/);
  assert.match(text, /Outbound errors:\s+4/);
  assert.match(text, /\$0\.0123/);
  assert.match(text, /17 {2}pricing/);
});

test('renderErrorAlertText: includes counts and percentage', () => {
  const text = renderErrorAlertText({
    tenantName: 'Acme',
    windowStart: new Date('2024-06-15T09:00:00Z'),
    windowEnd: new Date('2024-06-15T10:00:00Z'),
    total: 50,
    errors: 20,
  });
  assert.match(text, /Acme/);
  assert.match(text, /20 of 50/);
  assert.match(text, /40%/);
});
