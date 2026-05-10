import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { logger } from '../config/logger.js';
import {
  DEFAULT_SCHEDULE,
  WEEKDAYS,
  validateSchedule,
} from '../lib/working-hours.js';

export const workingHoursRouter = Router();
workingHoursRouter.use(requireAuth);

/** Writes require OWNER or ADMIN; reads are open to any tenant member. */
const writeGate = requireRole('OWNER', 'ADMIN');

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const dayRangeSchema = z
  .object({
    open: z.string().regex(HHMM_RE),
    close: z.string().regex(HHMM_RE),
  })
  // Plain string compare is safe here — the regex above already validated
  // both sides, so we don't need to re-parse and risk throwing.
  .refine((v) => v.open !== v.close, { message: 'open and close must differ' });

const scheduleSchema = z.object(
  Object.fromEntries(
    WEEKDAYS.map((d) => [d, dayRangeSchema.nullable().optional()] as const),
  ),
);

const putSchema = z.object({
  enabled: z.boolean(),
  // IANA tz. Validated by Intl.DateTimeFormat below.
  timezone: z.string().min(1).max(64),
  schedule: scheduleSchema,
  oooMessage: z.string().max(2_000).optional().default(''),
});

/** GET — current working-hours config (with safe defaults for new tenants). */
workingHoursRouter.get('/', async (req: Request, res: Response) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: req.auth!.tid },
    select: {
      workingHoursEnabled: true,
      timezone: true,
      workingHours: true,
      oooMessage: true,
    },
  });
  res.json({
    enabled: tenant?.workingHoursEnabled ?? false,
    timezone: tenant?.timezone ?? 'UTC',
    schedule: tenant?.workingHours ?? DEFAULT_SCHEDULE,
    oooMessage: tenant?.oooMessage ?? '',
  });
});

/** PUT — replace the full config. */
workingHoursRouter.put('/', writeGate, async (req: Request, res: Response) => {
  const parsed = putSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
    return;
  }
  const { enabled, timezone, schedule, oooMessage } = parsed.data;

  // Validate timezone — Intl.DateTimeFormat throws RangeError for unknown zones.
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
  } catch {
    res.status(400).json({ error: 'invalid_timezone' });
    return;
  }

  // Defense in depth: re-validate schedule shape (the zod check is structural,
  // this also runs the per-day refinements).
  let cleanedSchedule;
  try {
    cleanedSchedule = validateSchedule(schedule);
  } catch (err) {
    logger.warn({ err }, 'invalid_schedule_post_zod');
    res.status(400).json({ error: 'invalid_schedule' });
    return;
  }

  const tenant = await prisma.tenant.update({
    where: { id: req.auth!.tid },
    data: {
      workingHoursEnabled: enabled,
      timezone,
      // Prisma's Json column type wants InputJsonValue. Schedule is plain JSON.
      workingHours: cleanedSchedule as Prisma.InputJsonValue,
      oooMessage: oooMessage.trim() || null,
    },
    select: {
      workingHoursEnabled: true,
      timezone: true,
      workingHours: true,
      oooMessage: true,
    },
  });

  res.json({
    enabled: tenant.workingHoursEnabled,
    timezone: tenant.timezone,
    schedule: tenant.workingHours,
    oooMessage: tenant.oooMessage ?? '',
  });
});
