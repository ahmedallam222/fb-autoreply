import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../lib/auth.js';
import { sendEmail, isMailerConfigured, verifyMailerConfig } from '../lib/mailer.js';
import { logger } from '../config/logger.js';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

const putSchema = z.object({
  errorAlertsEnabled: z.boolean(),
  dailyDigestEnabled: z.boolean(),
  // Free-form comma-separated list. We accept anything; the runtime mailer
  // will skip invalid addresses silently. Empty/null means "use OWNER emails".
  recipientOverride: z.string().max(500).optional().nullable(),
});

/** GET — current preferences (default-on for new tenants). */
notificationsRouter.get('/', async (req: Request, res: Response) => {
  const pref = await prisma.notificationPreference.findUnique({
    where: { tenantId: req.auth!.tid },
  });
  res.json({
    errorAlertsEnabled: pref?.errorAlertsEnabled ?? true,
    dailyDigestEnabled: pref?.dailyDigestEnabled ?? true,
    recipientOverride: pref?.recipientOverride ?? '',
    smtpConfigured: isMailerConfigured(),
    lastErrorAlertAt: pref?.lastErrorAlertAt ?? null,
    lastDailyDigestSentAt: pref?.lastDailyDigestSentAt ?? null,
  });
});

/** PUT — update preferences. */
notificationsRouter.put('/', async (req: Request, res: Response) => {
  const parsed = putSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
    return;
  }
  const { errorAlertsEnabled, dailyDigestEnabled, recipientOverride } = parsed.data;
  const cleanOverride =
    recipientOverride && recipientOverride.trim() ? recipientOverride.trim() : null;

  const pref = await prisma.notificationPreference.upsert({
    where: { tenantId: req.auth!.tid },
    create: {
      tenantId: req.auth!.tid,
      errorAlertsEnabled,
      dailyDigestEnabled,
      recipientOverride: cleanOverride,
    },
    update: {
      errorAlertsEnabled,
      dailyDigestEnabled,
      recipientOverride: cleanOverride,
    },
  });

  res.json({
    errorAlertsEnabled: pref.errorAlertsEnabled,
    dailyDigestEnabled: pref.dailyDigestEnabled,
    recipientOverride: pref.recipientOverride ?? '',
    smtpConfigured: isMailerConfigured(),
  });
});

/** POST /test — send a test email to the configured recipients. */
notificationsRouter.post('/test', async (req: Request, res: Response) => {
  if (!isMailerConfigured()) {
    res.status(503).json({ error: 'smtp_not_configured' });
    return;
  }

  // Verify the SMTP credentials at runtime so we get a clear error to surface.
  try {
    await verifyMailerConfig();
  } catch (err) {
    logger.warn({ err }, 'smtp_verify_failed');
    res.status(503).json({ error: 'smtp_verify_failed' });
    return;
  }

  const pref = await prisma.notificationPreference.findUnique({
    where: { tenantId: req.auth!.tid },
  });
  const ownerEmails = await prisma.user.findMany({
    where: { tenantId: req.auth!.tid, role: 'OWNER' },
    select: { email: true },
  });
  const recipientList =
    pref?.recipientOverride && pref.recipientOverride.trim()
      ? pref.recipientOverride.split(',').map((e) => e.trim()).filter(Boolean)
      : ownerEmails.map((o) => o.email);

  const result = await sendEmail({
    to: recipientList,
    subject: '[fb-autoreply] Test email — your notifications are wired up',
    text: [
      'This is a test email from fb-autoreply.',
      '',
      `Sent at: ${new Date().toISOString()}`,
      `Recipients: ${recipientList.join(', ')}`,
      '',
      'If you got this, your SMTP credentials are correct and future error',
      'alerts + daily digests will land in this inbox.',
      '',
      '— fb-autoreply',
    ].join('\n'),
  });

  if (!result.delivered) {
    res.status(500).json({ error: 'send_failed', reason: result.reason ?? 'unknown' });
    return;
  }
  res.json({ ok: true, messageId: result.messageId, recipients: recipientList });
});
