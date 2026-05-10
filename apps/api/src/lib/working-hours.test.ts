import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseHHMM,
  validateSchedule,
  isWithinWorkingHours,
  DEFAULT_SCHEDULE,
  WEEKDAYS,
} from './working-hours.js';

test('parseHHMM accepts valid times', () => {
  assert.equal(parseHHMM('00:00'), 0);
  assert.equal(parseHHMM('09:30'), 9 * 60 + 30);
  assert.equal(parseHHMM('23:59'), 23 * 60 + 59);
});

test('parseHHMM rejects invalid strings', () => {
  assert.throws(() => parseHHMM('24:00'));
  assert.throws(() => parseHHMM('9:30')); // missing leading zero
  assert.throws(() => parseHHMM('09:60'));
  assert.throws(() => parseHHMM(''));
});

test('validateSchedule passes through a valid schedule', () => {
  const s = { mon: { open: '09:00', close: '18:00' }, sat: null };
  const out = validateSchedule(s);
  assert.deepEqual(out.mon, { open: '09:00', close: '18:00' });
  assert.equal(out.sat, null);
});

test('validateSchedule rejects unknown days', () => {
  assert.throws(() => validateSchedule({ funday: { open: '09:00', close: '18:00' } }));
});

test('validateSchedule rejects malformed range', () => {
  assert.throws(() => validateSchedule({ mon: { open: 'noon', close: '18:00' } }));
  assert.throws(() => validateSchedule({ mon: { open: '09:00' } }));
});

test('isWithinWorkingHours: weekday inside hours (UTC)', () => {
  // Wednesday 2024-01-10 13:00 UTC
  const now = new Date('2024-01-10T13:00:00Z');
  assert.equal(isWithinWorkingHours(DEFAULT_SCHEDULE, 'UTC', now), true);
});

test('isWithinWorkingHours: weekday before open hours', () => {
  // Wed 08:30 UTC, schedule opens at 09:00
  const now = new Date('2024-01-10T08:30:00Z');
  assert.equal(isWithinWorkingHours(DEFAULT_SCHEDULE, 'UTC', now), false);
});

test('isWithinWorkingHours: weekday at close minute is exclusive', () => {
  // Wed 18:00 UTC == close → outside
  const now = new Date('2024-01-10T18:00:00Z');
  assert.equal(isWithinWorkingHours(DEFAULT_SCHEDULE, 'UTC', now), false);
});

test('isWithinWorkingHours: weekend is closed', () => {
  // Saturday 2024-01-13 13:00 UTC
  const now = new Date('2024-01-13T13:00:00Z');
  assert.equal(isWithinWorkingHours(DEFAULT_SCHEDULE, 'UTC', now), false);
});

test('isWithinWorkingHours respects the tenant timezone (Africa/Cairo)', () => {
  // 2024-01-10 06:00 UTC = 2024-01-10 08:00 Cairo (UTC+2 in winter)
  const utcMorning = new Date('2024-01-10T06:00:00Z');
  assert.equal(isWithinWorkingHours(DEFAULT_SCHEDULE, 'Africa/Cairo', utcMorning), false);
  // 2024-01-10 08:00 UTC = 2024-01-10 10:00 Cairo
  const cairoMidMorning = new Date('2024-01-10T08:00:00Z');
  assert.equal(isWithinWorkingHours(DEFAULT_SCHEDULE, 'Africa/Cairo', cairoMidMorning), true);
});

test('isWithinWorkingHours wraps over midnight when close <= open', () => {
  const overnight = {
    mon: { open: '22:00', close: '02:00' },
    tue: { open: '22:00', close: '02:00' },
  };
  // Mon 22:30 UTC → inside
  assert.equal(isWithinWorkingHours(overnight, 'UTC', new Date('2024-01-08T22:30:00Z')), true);
  // Tue 01:30 UTC → still inside (wrap from Mon)
  assert.equal(isWithinWorkingHours(overnight, 'UTC', new Date('2024-01-09T01:30:00Z')), true);
  // Tue 02:00 UTC → outside (close is exclusive)
  assert.equal(isWithinWorkingHours(overnight, 'UTC', new Date('2024-01-09T02:00:00Z')), false);
  // Tue 21:30 UTC → still outside (Tue range hasn't started yet)
  assert.equal(isWithinWorkingHours(overnight, 'UTC', new Date('2024-01-09T21:30:00Z')), false);
});

test('isWithinWorkingHours: closed days are explicitly null', () => {
  const onlyMon = { mon: { open: '09:00', close: '18:00' } };
  // Tue at 13:00 → no entry → outside
  assert.equal(isWithinWorkingHours(onlyMon, 'UTC', new Date('2024-01-09T13:00:00Z')), false);
});

test('WEEKDAYS contains all 7 days in monday-first order', () => {
  assert.deepEqual([...WEEKDAYS], ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
});
