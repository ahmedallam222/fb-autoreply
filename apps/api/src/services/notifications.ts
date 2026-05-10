/**
 * Email-notification service.
 *
 * Two alert types, both per-tenant:
 *   1. Error spike — when in the last hour we attempted >= MIN_REPLIES outbound
 *      replies and the error rate is >= ERROR_RATE_THRESHOLD, send an alert.
 *      Cooldown enforced via NotificationPreference.lastErrorAlertAt.
 *   2. Daily digest — once per day per tenant, summarising the last 24h.
 *
 * The decision logic is split out as pure functions so it can be unit tested
 * without a clock or DB.
 */
import { prisma } from '../lib/prisma.js';
import { logger } from '../config/logger.js';
import { sendEmail } from '../lib/mailer.js';
import { env } from '../config/env.js';

export const ERROR_ALERT_MIN_REPLIES = 10;
export const ERROR_ALERT_RATE_THRESHOLD = 0.3;
export const ERROR_ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1h
export const DAILY_DIGEST_HOUR_UTC = 9;

export interface ErrorWindowStats {
  /** outbound replies attempted in the window (errors + successes) */
  total: number;
  /** outbound replies that failed (errorMessage non-null) */
  errors: number;
}

/** Pure: should we fire an error-spike alert? */
export function shouldFireErrorAlert(args: {
  enabled: boolean;
  stats: ErrorWindowStats;
  lastFiredAt: Date | null;
  now: Date;
}): boolean {
  if (!args.enabled) return false;
  if (args.stats.total < ERROR_ALERT_MIN_REPLIES) return false;
  const rate = args.stats.errors / args.stats.total;
  if (rate < ERROR_ALERT_RATE_THRESHOLD) return false;
  if (args.lastFiredAt) {
    const elapsed = args.now.getTime() - args.lastFiredAt.getTime();
    if (elapsed < ERROR_ALERT_COOLDOWN_MS) return false;
  }
  return true;
}

/** Pure: should we send today's daily digest? */
export function shouldSendDailyDigest(args: {
  enabled: boolean;
  lastSentAt: Date | null;
  now: Date;
}): boolean {
  if (!args.enabled) return false;
  // We only send during the configured UTC hour to stagger load and to
  // give consumers a stable expectation of when the email arrives.
  if (args.now.getUTCHours() !== DAILY_DIGEST_HOUR_UTC) return false;
  if (!args.lastSentAt) return true;
  // Don't fire twice in the same UTC day even if the scheduler ticks more
  // than once during the target hour.
  const sameUtcDay =
    args.lastSentAt.getUTCFullYear() === args.now.getUTCFullYear() &&
    args.lastSentAt.getUTCMonth() === args.now.getUTCMonth() &&
    args.lastSentAt.getUTCDate() === args.now.getUTCDate();
  return !sameUtcDay;
}

interface RecipientSource {
  recipientOverride: string | null;
  ownerEmails: string[];
}

export function resolveRecipients(src: RecipientSource): string[] {
  if (src.recipientOverride && src.recipientOverride.trim()) {
    return src.recipientOverride
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e.length > 0);
  }
  return src.ownerEmails.filter((e) => e && e.trim());
}

interface DailyDigestData {
  tenantName: string;
  windowStart: Date;
  windowEnd: Date;
  inboundCount: number;
  outboundSuccessCount: number;
  outboundErrorCount: number;
  topRules: { name: string; count: number }[];
  aiCostUsd: number | null;
}

export function renderDailyDigestText(d: DailyDigestData): string {
  const lines = [
    `Daily summary for ${d.tenantName}`,
    `${d.windowStart.toISOString()} → ${d.windowEnd.toISOString()}`,
    '',
    `Inbound messages:           ${d.inboundCount}`,
    `Replies sent:               ${d.outboundSuccessCount}`,
    `Outbound errors:            ${d.outboundErrorCount}`,
  ];
  if (d.aiCostUsd != null) {
    lines.push(`Estimated AI cost (USD):    $${d.aiCostUsd.toFixed(4)}`);
  }
  if (d.topRules.length > 0) {
    lines.push('', 'Top rules:');
    for (const r of d.topRules) lines.push(`  ${r.count.toString().padStart(4, ' ')}  ${r.name}`);
  }
  lines.push('', '— fb-autoreply');
  return lines.join('\n');
}

interface ErrorAlertData {
  tenantName: string;
  windowStart: Date;
  windowEnd: Date;
  total: number;
  errors: number;
}

export function renderErrorAlertText(d: ErrorAlertData): string {
  const rate = (d.errors / d.total) * 100;
  return [
    `⚠️  Error spike on ${d.tenantName}`,
    '',
    `In the last hour (${d.windowStart.toISOString()} → ${d.windowEnd.toISOString()})`,
    `${d.errors} of ${d.total} outbound replies failed (${rate.toFixed(0)}%).`,
    '',
    'Common causes:',
    '  - Page Access Token expired or revoked',
    '  - Rate-limit pressure from Meta',
    '  - Invalid OOO / rule template syntax',
    '',
    'You will not receive another alert for at least an hour.',
    '',
    '— fb-autoreply',
  ].join('\n');
}

/* -------- runtime: data access + tick functions -------- */

interface TenantPrefRow {
  id: string;
  tenantId: string;
  errorAlertsEnabled: boolean;
  dailyDigestEnabled: boolean;
  recipientOverride: string | null;
  lastErrorAlertAt: Date | null;
  lastDailyDigestSentAt: Date | null;
  tenant: { id: string; name: string };
}

/** Load tenants that have ANY notification subscription (default-on). */
async function loadActiveTenants(): Promise<TenantPrefRow[]> {
  // Tenants without a row are treated as default-on (errorAlerts + dailyDigest).
  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true, notificationPreference: true },
  });
  return tenants.map((t) => ({
    id: t.notificationPreference?.id ?? '',
    tenantId: t.id,
    errorAlertsEnabled: t.notificationPreference?.errorAlertsEnabled ?? true,
    dailyDigestEnabled: t.notificationPreference?.dailyDigestEnabled ?? true,
    recipientOverride: t.notificationPreference?.recipientOverride ?? null,
    lastErrorAlertAt: t.notificationPreference?.lastErrorAlertAt ?? null,
    lastDailyDigestSentAt: t.notificationPreference?.lastDailyDigestSentAt ?? null,
    tenant: { id: t.id, name: t.name },
  }));
}

async function ownerEmailsFor(tenantId: string): Promise<string[]> {
  const owners = await prisma.user.findMany({
    where: { tenantId, role: 'OWNER' },
    select: { email: true },
  });
  return owners.map((o) => o.email);
}

async function errorWindowStats(tenantId: string, windowStart: Date): Promise<ErrorWindowStats> {
  const [total, errors] = await Promise.all([
    prisma.replyEvent.count({
      where: {
        direction: 'OUTBOUND',
        createdAt: { gte: windowStart },
        conversation: { tenantId },
      },
    }),
    prisma.replyEvent.count({
      where: {
        direction: 'OUTBOUND',
        createdAt: { gte: windowStart },
        conversation: { tenantId },
        errorMessage: { not: null },
      },
    }),
  ]);
  return { total, errors };
}

async function dailyDigestData(
  tenantId: string,
  tenantName: string,
  windowStart: Date,
  windowEnd: Date,
): Promise<DailyDigestData> {
  const [inboundCount, outboundSuccessCount, outboundErrorCount, topRulesAgg, aiAgg] =
    await Promise.all([
      prisma.replyEvent.count({
        where: {
          direction: 'INBOUND',
          createdAt: { gte: windowStart, lt: windowEnd },
          conversation: { tenantId },
        },
      }),
      prisma.replyEvent.count({
        where: {
          direction: 'OUTBOUND',
          createdAt: { gte: windowStart, lt: windowEnd },
          conversation: { tenantId },
          errorMessage: null,
        },
      }),
      prisma.replyEvent.count({
        where: {
          direction: 'OUTBOUND',
          createdAt: { gte: windowStart, lt: windowEnd },
          conversation: { tenantId },
          errorMessage: { not: null },
        },
      }),
      prisma.replyEvent.groupBy({
        by: ['matchedRuleId'],
        where: {
          direction: 'OUTBOUND',
          createdAt: { gte: windowStart, lt: windowEnd },
          conversation: { tenantId },
          matchedRuleId: { not: null },
        },
        _count: { _all: true },
        orderBy: { _count: { matchedRuleId: 'desc' } },
        take: 3,
      }),
      prisma.replyEvent.aggregate({
        where: {
          direction: 'OUTBOUND',
          createdAt: { gte: windowStart, lt: windowEnd },
          conversation: { tenantId },
          source: 'AI',
        },
        _sum: { aiPromptTokens: true, aiCompletionTokens: true },
      }),
    ]);

  const ruleNames = await prisma.rule.findMany({
    where: {
      id: { in: topRulesAgg.map((r) => r.matchedRuleId).filter((s): s is string => Boolean(s)) },
    },
    select: { id: true, name: true },
  });
  const ruleNameById = new Map(ruleNames.map((r) => [r.id, r.name]));

  const promptT = aiAgg._sum.aiPromptTokens ?? 0;
  const completionT = aiAgg._sum.aiCompletionTokens ?? 0;
  // Cheap default — exposes a number even when models change. Real tenants
  // will get the model-specific cost from /api/analytics/cost.
  const aiCostUsd = promptT + completionT > 0 ? (promptT * 0.15 + completionT * 0.6) / 1_000_000 : null;

  return {
    tenantName,
    windowStart,
    windowEnd,
    inboundCount,
    outboundSuccessCount,
    outboundErrorCount,
    topRules: topRulesAgg.map((r) => ({
      name: r.matchedRuleId ? ruleNameById.get(r.matchedRuleId) ?? r.matchedRuleId : 'unknown',
      count: r._count._all,
    })),
    aiCostUsd,
  };
}

async function recordSent(
  tenantId: string,
  field: 'lastErrorAlertAt' | 'lastDailyDigestSentAt',
  at: Date,
) {
  await prisma.notificationPreference.upsert({
    where: { tenantId },
    create: { tenantId, [field]: at },
    update: { [field]: at },
  });
}

/** Run one full pass: error alerts + daily digests for every tenant. */
export async function runNotificationTick(now: Date = new Date()): Promise<void> {
  const tenants = await loadActiveTenants();
  for (const t of tenants) {
    try {
      // 1. Error-spike alert
      if (t.errorAlertsEnabled) {
        const windowStart = new Date(now.getTime() - 60 * 60 * 1000);
        const stats = await errorWindowStats(t.tenantId, windowStart);
        if (
          shouldFireErrorAlert({
            enabled: true,
            stats,
            lastFiredAt: t.lastErrorAlertAt,
            now,
          })
        ) {
          const ownerEmails = await ownerEmailsFor(t.tenantId);
          const recipients = resolveRecipients({
            recipientOverride: t.recipientOverride,
            ownerEmails,
          });
          await sendEmail({
            to: recipients,
            subject: `[fb-autoreply] Error spike on ${t.tenant.name}`,
            text: renderErrorAlertText({
              tenantName: t.tenant.name,
              windowStart,
              windowEnd: now,
              total: stats.total,
              errors: stats.errors,
            }),
          });
          await recordSent(t.tenantId, 'lastErrorAlertAt', now);
        }
      }

      // 2. Daily digest
      if (
        shouldSendDailyDigest({
          enabled: t.dailyDigestEnabled,
          lastSentAt: t.lastDailyDigestSentAt,
          now,
        })
      ) {
        const windowEnd = now;
        const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const data = await dailyDigestData(
          t.tenantId,
          t.tenant.name,
          windowStart,
          windowEnd,
        );
        const ownerEmails = await ownerEmailsFor(t.tenantId);
        const recipients = resolveRecipients({
          recipientOverride: t.recipientOverride,
          ownerEmails,
        });
        await sendEmail({
          to: recipients,
          subject: `[fb-autoreply] Daily summary for ${t.tenant.name}`,
          text: renderDailyDigestText(data),
        });
        await recordSent(t.tenantId, 'lastDailyDigestSentAt', now);
      }
    } catch (err) {
      logger.error({ err, tenantId: t.tenantId }, 'notification_tick_failed_for_tenant');
    }
  }
}

let schedulerHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Start the in-process scheduler. Ticks every 5 minutes; the per-alert
 * cooldown / per-day check inside runNotificationTick prevents duplicates.
 *
 * NOTE: in-process. If you ever scale to >1 instance, set
 * NOTIFICATIONS_SCHEDULER_ENABLED=false on all but one of them.
 */
export function startNotificationScheduler(): void {
  if (!env.NOTIFICATIONS_SCHEDULER_ENABLED) {
    logger.info('notification_scheduler_disabled_by_env');
    return;
  }
  if (schedulerHandle) return;
  const TICK_MS = 5 * 60 * 1000;
  // Don't tick immediately on startup — wait one cycle so the API can serve traffic first.
  schedulerHandle = setInterval(() => {
    runNotificationTick().catch((err) =>
      logger.error({ err }, 'notification_tick_failed'),
    );
  }, TICK_MS);
  // setInterval shouldn't keep the event loop alive on shutdown.
  if (typeof schedulerHandle.unref === 'function') schedulerHandle.unref();
  logger.info({ tickMs: TICK_MS }, 'notification_scheduler_started');
}

export function stopNotificationScheduler(): void {
  if (schedulerHandle) {
    clearInterval(schedulerHandle);
    schedulerHandle = null;
  }
}
