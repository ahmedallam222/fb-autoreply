import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole, hashPassword, signToken } from '../lib/auth.js';
import { sendEmail, isMailerConfigured } from '../lib/mailer.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

export const teamRouter = Router();

/* ------------------------------------------------------------------ *
 * Public (no auth): accept an invite using its token.
 * Mounted before requireAuth so the new user doesn't need a JWT yet.
 * ------------------------------------------------------------------ */

const acceptSchema = z.object({
  password: z.string().min(8, 'password too short'),
  name: z.string().trim().min(1).max(120).optional(),
});

teamRouter.get('/invites/:token', async (req: Request, res: Response) => {
  const token = req.params.token;
  if (!token) {
    res.status(400).json({ error: 'missing_token' });
    return;
  }
  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { tenant: { select: { name: true } } },
  });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    res.status(404).json({ error: 'invite_invalid_or_expired' });
    return;
  }
  res.json({
    email: invite.email,
    role: invite.role,
    tenantName: invite.tenant.name,
    expiresAt: invite.expiresAt,
  });
});

teamRouter.post('/invites/:token/accept', async (req: Request, res: Response) => {
  const token = req.params.token;
  if (!token) {
    res.status(400).json({ error: 'missing_token' });
    return;
  }
  const parsed = acceptSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
    return;
  }

  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    res.status(404).json({ error: 'invite_invalid_or_expired' });
    return;
  }

  // The User table has email as a global unique constraint, so we must reject
  // accepting if that email is already in use anywhere.
  const existing = await prisma.user.findUnique({ where: { email: invite.email } });
  if (existing) {
    res.status(409).json({ error: 'email_already_registered' });
    return;
  }

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: invite.email,
        name: parsed.data.name ?? null,
        passwordHash: await hashPassword(parsed.data.password),
        role: invite.role,
        tenantId: invite.tenantId,
      },
    });
    await tx.invite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
    return created;
  });

  const jwt = signToken({ sub: user.id, tid: user.tenantId, role: user.role });
  res.status(201).json({
    token: jwt,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

/* ------------------------------------------------------------------ *
 * Authenticated routes. Everything below requires a logged-in user.
 * ------------------------------------------------------------------ */

teamRouter.use(requireAuth);

/** GET /api/team — list members + pending invites. Anyone in the tenant can read. */
teamRouter.get('/', async (req: Request, res: Response) => {
  const [members, invites] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId: req.auth!.tid },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    }),
    prisma.invite.findMany({
      where: { tenantId: req.auth!.tid, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
    }),
  ]);
  res.json({ members, pendingInvites: invites });
});

/** POST /api/team/invites — OWNER/ADMIN only. */
const inviteSchema = z.object({
  email: z.string().email().max(254),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER']),
});

teamRouter.post('/invites', requireRole('OWNER', 'ADMIN'), async (req: Request, res: Response) => {
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
    return;
  }
  const { email, role } = parsed.data;

  // Only OWNERs can create another OWNER.
  if (role === 'OWNER' && req.auth!.role !== 'OWNER') {
    res.status(403).json({ error: 'only_owner_can_create_owner' });
    return;
  }

  // Reject if email already belongs to a user in any tenant — they'd be unable
  // to accept anyway because of the unique constraint.
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    res.status(409).json({ error: 'email_already_registered' });
    return;
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7d
  const invite = await prisma.invite.create({
    data: {
      tenantId: req.auth!.tid,
      email,
      role,
      token,
      expiresAt,
      createdById: req.auth!.sub,
    },
  });

  const acceptUrl = `${env.PUBLIC_WEB_URL.replace(/\/$/, '')}/invite/${token}`;
  const tenant = await prisma.tenant.findUnique({
    where: { id: req.auth!.tid },
    select: { name: true },
  });

  // Best-effort email send. If SMTP isn't configured, we still return the URL
  // so the inviter can paste it into Slack/WhatsApp/etc.
  let emailDelivered = false;
  if (isMailerConfigured()) {
    try {
      const r = await sendEmail({
        to: [email],
        subject: `You've been invited to ${tenant?.name ?? 'a workspace'} on fb-autoreply`,
        text: [
          `Hi,`,
          ``,
          `You've been invited to join "${tenant?.name ?? 'a workspace'}" on fb-autoreply as a ${role.toLowerCase()}.`,
          ``,
          `Accept the invite by opening this link (expires in 7 days):`,
          acceptUrl,
          ``,
          `If you weren't expecting this, you can safely ignore this email.`,
          ``,
          `— fb-autoreply`,
        ].join('\n'),
      });
      emailDelivered = r.delivered;
    } catch (err) {
      logger.warn({ err, inviteId: invite.id }, 'invite_email_send_failed');
    }
  }

  res.status(201).json({
    invite: {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
    },
    acceptUrl,
    emailDelivered,
  });
});

/** DELETE /api/team/invites/:id — OWNER/ADMIN only. Revoke a pending invite. */
teamRouter.delete(
  '/invites/:id',
  requireRole('OWNER', 'ADMIN'),
  async (req: Request, res: Response) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'missing_id' });
      return;
    }
    // Scope by tenant to prevent cross-tenant deletion via a guessed id.
    const result = await prisma.invite.deleteMany({
      where: { id, tenantId: req.auth!.tid, acceptedAt: null },
    });
    if (result.count === 0) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.status(204).send();
  },
);

/** PATCH /api/team/members/:userId — OWNER only. Change a member's role. */
const patchMemberSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER']),
});

teamRouter.patch(
  '/members/:userId',
  requireRole('OWNER'),
  async (req: Request, res: Response) => {
    const userId = req.params.userId;
    if (!userId) {
      res.status(400).json({ error: 'missing_id' });
      return;
    }
    const parsed = patchMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
      return;
    }
    const target = await prisma.user.findFirst({
      where: { id: userId, tenantId: req.auth!.tid },
    });
    if (!target) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    // Don't allow demoting the last OWNER — would lock the tenant out of
    // ever changing roles again.
    if (target.role === 'OWNER' && parsed.data.role !== 'OWNER') {
      const ownerCount = await prisma.user.count({
        where: { tenantId: req.auth!.tid, role: 'OWNER' },
      });
      if (ownerCount <= 1) {
        res.status(409).json({ error: 'cannot_demote_last_owner' });
        return;
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role: parsed.data.role },
      select: { id: true, email: true, name: true, role: true },
    });
    res.json({ member: updated });
  },
);

/** DELETE /api/team/members/:userId — OWNER only. Remove a member. */
teamRouter.delete(
  '/members/:userId',
  requireRole('OWNER'),
  async (req: Request, res: Response) => {
    const userId = req.params.userId;
    if (!userId) {
      res.status(400).json({ error: 'missing_id' });
      return;
    }
    if (userId === req.auth!.sub) {
      res.status(409).json({ error: 'cannot_remove_self' });
      return;
    }
    const target = await prisma.user.findFirst({
      where: { id: userId, tenantId: req.auth!.tid },
    });
    if (!target) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    if (target.role === 'OWNER') {
      const ownerCount = await prisma.user.count({
        where: { tenantId: req.auth!.tid, role: 'OWNER' },
      });
      if (ownerCount <= 1) {
        res.status(409).json({ error: 'cannot_remove_last_owner' });
        return;
      }
    }
    await prisma.user.delete({ where: { id: userId } });
    res.status(204).send();
  },
);
