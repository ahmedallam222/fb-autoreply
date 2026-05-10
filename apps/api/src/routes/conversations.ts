import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../lib/auth.js';

export const conversationsRouter = Router();
conversationsRouter.use(requireAuth);

conversationsRouter.get('/', async (req: Request, res: Response) => {
  const conversations = await prisma.conversation.findMany({
    where: { tenantId: req.auth!.tid },
    orderBy: { lastMessageAt: 'desc' },
    take: 100,
    include: {
      page: { select: { name: true, fbPageId: true } },
      _count: { select: { events: true } },
    },
  });
  res.json({ conversations });
});

conversationsRouter.get('/:id', async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ error: 'missing_id' });
    return;
  }
  const convo = await prisma.conversation.findFirst({
    where: { id, tenantId: req.auth!.tid },
    include: {
      page: { select: { name: true, fbPageId: true } },
      events: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!convo) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ conversation: convo });
});
