import { Router, type Request, type Response } from 'express';
import { aiConfigSchema } from '@fb-autoreply/shared';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../lib/auth.js';

export const aiRouter = Router();
aiRouter.use(requireAuth);

/** Writes require OWNER or ADMIN; reads are open to any tenant member. */
const writeGate = requireRole('OWNER', 'ADMIN');

aiRouter.get('/', async (req: Request, res: Response) => {
  const cfg = await prisma.aiConfig.findUnique({ where: { tenantId: req.auth!.tid } });
  res.json({ aiConfig: cfg });
});

aiRouter.put('/', writeGate, async (req: Request, res: Response) => {
  const parsed = aiConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }
  const d = parsed.data;
  const cfg = await prisma.aiConfig.upsert({
    where: { tenantId: req.auth!.tid },
    create: { tenantId: req.auth!.tid, ...d },
    update: { ...d },
  });
  res.json({ aiConfig: cfg });
});
