import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { hashPassword, requireAuth, signToken, verifyPassword } from '../lib/auth.js';

export const authRouter = Router();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
  tenantName: z.string().min(1),
});

authRouter.post('/signup', async (req: Request, res: Response) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }
  const { email, password, name, tenantName } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'email_taken' });
    return;
  }

  const user = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({ data: { name: tenantName } });
    return tx.user.create({
      data: {
        email,
        name,
        passwordHash: await hashPassword(password),
        tenantId: tenant.id,
        role: 'OWNER',
      },
    });
  });

  const token = signToken({ sub: user.id, tid: user.tenantId, role: user.role });
  res.status(201).json({ token, user: publicUser(user) });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input' });
    return;
  }
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    res.status(401).json({ error: 'invalid_credentials' });
    return;
  }
  const token = signToken({ sub: user.id, tid: user.tenantId, role: user.role });
  res.json({ token, user: publicUser(user) });
});

authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.sub },
    include: { tenant: true },
  });
  if (!user) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ user: publicUser(user), tenant: { id: user.tenant.id, name: user.tenant.name } });
});

function publicUser(u: { id: string; email: string; name: string | null; role: string; tenantId: string }) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, tenantId: u.tenantId };
}
