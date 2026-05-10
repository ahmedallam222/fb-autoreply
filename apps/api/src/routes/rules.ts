import { Router, type Request, type Response } from 'express';
import { ruleSchema } from '@fb-autoreply/shared';
import type { RuleChannel, RuleMatchType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../lib/auth.js';
import { RULE_TEMPLATES } from '../lib/rule-templates.js';

export const rulesRouter = Router();
rulesRouter.use(requireAuth);

/**
 * Preset rule templates shown in the onboarding wizard.
 * Static — does not hit the database.
 */
rulesRouter.get('/templates', (_req: Request, res: Response) => {
  res.json({ templates: RULE_TEMPLATES });
});

rulesRouter.get('/', async (req: Request, res: Response) => {
  const rules = await prisma.rule.findMany({
    where: { tenantId: req.auth!.tid },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  });
  res.json({ rules });
});

rulesRouter.post('/', async (req: Request, res: Response) => {
  const parsed = ruleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }
  const data = parsed.data;
  const rule = await prisma.rule.create({
    data: {
      tenantId: req.auth!.tid,
      name: data.name,
      enabled: data.enabled,
      channel: data.channel.toUpperCase() as RuleChannel,
      matchType: data.matchType.toUpperCase() as RuleMatchType,
      keywords: data.keywords,
      caseSensitive: data.caseSensitive,
      responseTemplate: data.responseTemplate,
      priority: data.priority,
      cooldownSeconds: data.cooldownSeconds,
    },
  });
  res.status(201).json({ rule });
});

rulesRouter.put('/:id', async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ error: 'missing_id' });
    return;
  }
  const existing = await prisma.rule.findFirst({
    where: { id, tenantId: req.auth!.tid },
  });
  if (!existing) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  const parsed = ruleSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }
  const d = parsed.data;
  const rule = await prisma.rule.update({
    where: { id: existing.id },
    data: {
      name: d.name,
      enabled: d.enabled,
      channel: d.channel ? (d.channel.toUpperCase() as RuleChannel) : undefined,
      matchType: d.matchType ? (d.matchType.toUpperCase() as RuleMatchType) : undefined,
      keywords: d.keywords,
      caseSensitive: d.caseSensitive,
      responseTemplate: d.responseTemplate,
      priority: d.priority,
      cooldownSeconds: d.cooldownSeconds,
    },
  });
  res.json({ rule });
});

rulesRouter.delete('/:id', async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ error: 'missing_id' });
    return;
  }
  const existing = await prisma.rule.findFirst({
    where: { id, tenantId: req.auth!.tid },
  });
  if (!existing) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  await prisma.rule.delete({ where: { id: existing.id } });
  res.status(204).end();
});
