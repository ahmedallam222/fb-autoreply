import { Router, type Request, type Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../lib/auth.js';
import { estimateCostUsd } from '../lib/ai-pricing.js';

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

function parseDays(raw: unknown, fallback: number, max = 365): number {
  const n = typeof raw === 'string' ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

function startOfWindow(days: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return d;
}

/**
 * GET /api/analytics/summary?days=30
 *
 * Returns headline counts for the dashboard cards.
 */
analyticsRouter.get('/summary', async (req: Request, res: Response) => {
  const tenantId = req.auth!.tid;
  const days = parseDays(req.query.days, 30);
  const since = startOfWindow(days);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const last7 = new Date(today);
  last7.setUTCDate(last7.getUTCDate() - 6);

  const last30 = new Date(today);
  last30.setUTCDate(last30.getUTCDate() - 29);

  const [
    repliesToday,
    replies7d,
    replies30d,
    repliesInWindow,
    inboundInWindow,
    errorsInWindow,
    conversationsInWindow,
    sourceSplit,
  ] = await Promise.all([
    prisma.replyEvent.count({
      where: {
        direction: 'OUTBOUND',
        conversation: { tenantId },
        createdAt: { gte: today },
      },
    }),
    prisma.replyEvent.count({
      where: {
        direction: 'OUTBOUND',
        conversation: { tenantId },
        createdAt: { gte: last7 },
      },
    }),
    prisma.replyEvent.count({
      where: {
        direction: 'OUTBOUND',
        conversation: { tenantId },
        createdAt: { gte: last30 },
      },
    }),
    prisma.replyEvent.count({
      where: {
        direction: 'OUTBOUND',
        conversation: { tenantId },
        createdAt: { gte: since },
      },
    }),
    prisma.replyEvent.count({
      where: {
        direction: 'INBOUND',
        conversation: { tenantId },
        createdAt: { gte: since },
      },
    }),
    prisma.replyEvent.count({
      where: {
        direction: 'OUTBOUND',
        conversation: { tenantId },
        createdAt: { gte: since },
        errorMessage: { not: null },
      },
    }),
    prisma.conversation.count({
      where: { tenantId, lastMessageAt: { gte: since } },
    }),
    prisma.replyEvent.groupBy({
      by: ['source'],
      where: {
        direction: 'OUTBOUND',
        conversation: { tenantId },
        createdAt: { gte: since },
      },
      _count: { _all: true },
    }),
  ]);

  const split = { RULE: 0, AI: 0, MANUAL: 0, NONE: 0 } as Record<string, number>;
  for (const row of sourceSplit) {
    split[row.source] = row._count._all;
  }

  res.json({
    days,
    repliesToday,
    replies7d,
    replies30d,
    window: {
      replies: repliesInWindow,
      inbound: inboundInWindow,
      errors: errorsInWindow,
      conversations: conversationsInWindow,
      sourceSplit: split,
    },
  });
});

/**
 * GET /api/analytics/timeseries?days=30
 *
 * Returns per-day OUTBOUND reply counts split by source.
 * The frontend renders this as a bar chart.
 */
analyticsRouter.get('/timeseries', async (req: Request, res: Response) => {
  const tenantId = req.auth!.tid;
  const days = parseDays(req.query.days, 30);
  const since = startOfWindow(days);

  // Aggregate per UTC day per source. Conversation join filters by tenant.
  const rows = await prisma.$queryRaw<
    Array<{ day: Date; source: string; n: bigint }>
  >(Prisma.sql`
    SELECT date_trunc('day', e."createdAt") AS day,
           e."source"::text AS source,
           COUNT(*)::bigint AS n
    FROM "ReplyEvent" e
    JOIN "Conversation" c ON c.id = e."conversationId"
    WHERE c."tenantId" = ${tenantId}
      AND e."direction" = 'OUTBOUND'
      AND e."createdAt" >= ${since}
    GROUP BY 1, 2
    ORDER BY 1 ASC
  `);

  // Build a contiguous list of dates so the chart has gaps as zeros instead of missing.
  const series: Array<{ date: string; RULE: number; AI: number; MANUAL: number; NONE: number; total: number }> = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    series.push({
      date: d.toISOString().slice(0, 10),
      RULE: 0,
      AI: 0,
      MANUAL: 0,
      NONE: 0,
      total: 0,
    });
  }
  const byDate = new Map(series.map((s) => [s.date, s]));
  for (const row of rows) {
    const key = new Date(row.day).toISOString().slice(0, 10);
    const bucket = byDate.get(key);
    if (!bucket) continue;
    const n = Number(row.n);
    if (row.source === 'RULE' || row.source === 'AI' || row.source === 'MANUAL' || row.source === 'NONE') {
      bucket[row.source] += n;
      bucket.total += n;
    }
  }

  res.json({ days, series });
});

/**
 * GET /api/analytics/top-rules?days=30&limit=10
 *
 * Top matched rules by reply count.
 */
analyticsRouter.get('/top-rules', async (req: Request, res: Response) => {
  const tenantId = req.auth!.tid;
  const days = parseDays(req.query.days, 30);
  const limit = parseDays(req.query.limit, 10, 50);
  const since = startOfWindow(days);

  const grouped = await prisma.replyEvent.groupBy({
    by: ['matchedRuleId'],
    where: {
      direction: 'OUTBOUND',
      source: 'RULE',
      conversation: { tenantId },
      createdAt: { gte: since },
      matchedRuleId: { not: null },
    },
    _count: { _all: true },
    orderBy: { _count: { matchedRuleId: 'desc' } },
    take: limit,
  });

  const ruleIds = grouped.map((g) => g.matchedRuleId).filter((id): id is string => !!id);
  const rules = ruleIds.length
    ? await prisma.rule.findMany({
        where: { id: { in: ruleIds }, tenantId },
        select: { id: true, name: true, priority: true, enabled: true },
      })
    : [];
  const ruleById = new Map(rules.map((r) => [r.id, r]));

  res.json({
    days,
    items: grouped.map((g) => ({
      ruleId: g.matchedRuleId,
      name: g.matchedRuleId ? ruleById.get(g.matchedRuleId)?.name ?? '(deleted rule)' : '(unknown)',
      priority: g.matchedRuleId ? ruleById.get(g.matchedRuleId)?.priority ?? null : null,
      enabled: g.matchedRuleId ? ruleById.get(g.matchedRuleId)?.enabled ?? null : null,
      count: g._count._all,
    })),
  });
});

/**
 * GET /api/analytics/cost?days=30
 *
 * AI token usage and estimated cost (USD), grouped by model.
 */
analyticsRouter.get('/cost', async (req: Request, res: Response) => {
  const tenantId = req.auth!.tid;
  const days = parseDays(req.query.days, 30);
  const since = startOfWindow(days);

  const grouped = await prisma.replyEvent.groupBy({
    by: ['aiModel'],
    where: {
      direction: 'OUTBOUND',
      source: 'AI',
      conversation: { tenantId },
      createdAt: { gte: since },
    },
    _count: { _all: true },
    _sum: {
      aiPromptTokens: true,
      aiCompletionTokens: true,
    },
  });

  const items = grouped.map((g) => {
    const promptTokens = g._sum.aiPromptTokens ?? 0;
    const completionTokens = g._sum.aiCompletionTokens ?? 0;
    const costUsd = estimateCostUsd(g.aiModel, promptTokens, completionTokens);
    return {
      model: g.aiModel ?? 'unknown',
      replies: g._count._all,
      promptTokens,
      completionTokens,
      costUsd,
    };
  });

  const totals = items.reduce(
    (acc, item) => ({
      replies: acc.replies + item.replies,
      promptTokens: acc.promptTokens + item.promptTokens,
      completionTokens: acc.completionTokens + item.completionTokens,
      costUsd: acc.costUsd + item.costUsd,
    }),
    { replies: 0, promptTokens: 0, completionTokens: 0, costUsd: 0 },
  );

  res.json({ days, items, totals });
});
