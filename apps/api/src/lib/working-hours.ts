/**
 * Working-hours / out-of-office logic.
 *
 * The schedule is stored on Tenant as JSON, keyed by 3-letter weekday
 * (mon..sun). Each day is either `null` (closed all day) or a
 * `{ open: "HH:MM", close: "HH:MM" }` object (24h, in the tenant's
 * `timezone`). To handle ranges that cross midnight (e.g. 18:00 → 02:00),
 * `close <= open` is treated as wrapping to the next day.
 *
 * The "now" check is timezone-aware via Intl.DateTimeFormat — we never
 * compare raw Date getHours() values.
 */

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export const WEEKDAYS: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export interface DayRange {
  open: string;  // "HH:MM"
  close: string; // "HH:MM"
}

export type WorkingHoursSchedule = Partial<Record<Weekday, DayRange | null>>;

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Validates a "HH:MM" string. Returns the parsed minutes-of-day or throws. */
export function parseHHMM(s: string): number {
  const m = HHMM_RE.exec(s);
  if (!m) throw new Error(`Invalid HH:MM: ${JSON.stringify(s)}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Validate a schedule shape. Throws on invalid input. */
export function validateSchedule(input: unknown): WorkingHoursSchedule {
  if (input == null || typeof input !== 'object') {
    throw new Error('schedule must be an object');
  }
  const out: WorkingHoursSchedule = {};
  for (const [day, value] of Object.entries(input)) {
    if (!WEEKDAYS.includes(day as Weekday)) {
      throw new Error(`Unknown weekday key: ${day}`);
    }
    if (value === null || value === undefined) {
      out[day as Weekday] = null;
      continue;
    }
    if (typeof value !== 'object') {
      throw new Error(`schedule.${day} must be null or an object`);
    }
    const v = value as { open?: unknown; close?: unknown };
    if (typeof v.open !== 'string' || typeof v.close !== 'string') {
      throw new Error(`schedule.${day}.open and .close must be HH:MM strings`);
    }
    parseHHMM(v.open);
    parseHHMM(v.close);
    out[day as Weekday] = { open: v.open, close: v.close };
  }
  return out;
}

interface TenantNow {
  weekday: Weekday;
  minutesOfDay: number;
}

const WEEKDAY_FROM_INTL: Record<string, Weekday> = {
  Mon: 'mon', Tue: 'tue', Wed: 'wed', Thu: 'thu', Fri: 'fri', Sat: 'sat', Sun: 'sun',
};

/**
 * Compute the current weekday + minute-of-day in the tenant's timezone.
 * Throws if the timezone string is invalid.
 */
export function tenantLocalNow(timezone: string, now: Date = new Date()): TenantNow {
  // `Intl.DateTimeFormat` throws RangeError for unknown IANA zones.
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = fmt.formatToParts(now);
  const weekdayStr = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const hourStr = parts.find((p) => p.type === 'hour')?.value ?? '';
  const minuteStr = parts.find((p) => p.type === 'minute')?.value ?? '';
  const weekday = WEEKDAY_FROM_INTL[weekdayStr];
  if (!weekday) throw new Error(`Unexpected weekday from Intl: ${weekdayStr}`);
  // Some platforms emit '24' for midnight under hourCycle 'h23'. Normalize.
  const hour = Number(hourStr) % 24;
  const minute = Number(minuteStr);
  return { weekday, minutesOfDay: hour * 60 + minute };
}

const PREV_DAY: Record<Weekday, Weekday> = {
  mon: 'sun', tue: 'mon', wed: 'tue', thu: 'wed', fri: 'thu', sat: 'fri', sun: 'sat',
};

/**
 * Decide whether `now` (interpreted in `timezone`) is inside the schedule.
 * Ranges where `close <= open` are treated as wrapping to the next day
 * (e.g. open=22:00 close=02:00 means 22:00..23:59 today + 00:00..02:00 tomorrow).
 */
export function isWithinWorkingHours(
  schedule: WorkingHoursSchedule,
  timezone: string,
  now: Date = new Date(),
): boolean {
  const { weekday, minutesOfDay } = tenantLocalNow(timezone, now);

  // Same-day range
  const today = schedule[weekday];
  if (today) {
    const openM = parseHHMM(today.open);
    const closeM = parseHHMM(today.close);
    if (closeM > openM) {
      if (minutesOfDay >= openM && minutesOfDay < closeM) return true;
    } else {
      // Wraps over midnight — open..23:59 today
      if (minutesOfDay >= openM) return true;
    }
  }

  // Wrap-from-yesterday range
  const yesterday = schedule[PREV_DAY[weekday]];
  if (yesterday) {
    const openM = parseHHMM(yesterday.open);
    const closeM = parseHHMM(yesterday.close);
    if (closeM <= openM) {
      if (minutesOfDay < closeM) return true;
    }
  }
  return false;
}

/** Default schedule for new tenants (Mon–Fri 09:00–18:00, weekend closed). */
export const DEFAULT_SCHEDULE: WorkingHoursSchedule = {
  mon: { open: '09:00', close: '18:00' },
  tue: { open: '09:00', close: '18:00' },
  wed: { open: '09:00', close: '18:00' },
  thu: { open: '09:00', close: '18:00' },
  fri: { open: '09:00', close: '18:00' },
  sat: null,
  sun: null,
};
