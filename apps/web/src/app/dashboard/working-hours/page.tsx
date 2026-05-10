'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { api, swrFetcher } from '@/lib/api';

type Day = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
const DAYS: { key: Day; label: string }[] = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

// Curated subset; users can also paste a custom IANA zone.
const COMMON_TZS = [
  'UTC',
  'Africa/Cairo',
  'Africa/Casablanca',
  'Asia/Riyadh',
  'Asia/Dubai',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Los_Angeles',
];

interface DayRange { open: string; close: string }
type Schedule = Partial<Record<Day, DayRange | null>>;

interface Config {
  enabled: boolean;
  timezone: string;
  schedule: Schedule;
  oooMessage: string;
}

const DEFAULT_CFG: Config = {
  enabled: false,
  timezone: 'UTC',
  schedule: {
    mon: { open: '09:00', close: '18:00' },
    tue: { open: '09:00', close: '18:00' },
    wed: { open: '09:00', close: '18:00' },
    thu: { open: '09:00', close: '18:00' },
    fri: { open: '09:00', close: '18:00' },
    sat: null,
    sun: null,
  },
  oooMessage: '',
};

export default function WorkingHoursPage() {
  const { data, mutate } = useSWR<Config>('/api/working-hours', swrFetcher);
  const [cfg, setCfg] = useState<Config>(DEFAULT_CFG);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setCfg({
        enabled: data.enabled,
        timezone: data.timezone || 'UTC',
        schedule: { ...DEFAULT_CFG.schedule, ...(data.schedule ?? {}) },
        oooMessage: data.oooMessage ?? '',
      });
    }
  }, [data]);

  function setDayOpen(day: Day, isOpen: boolean) {
    setCfg((c) => ({
      ...c,
      schedule: {
        ...c.schedule,
        [day]: isOpen ? { open: '09:00', close: '18:00' } : null,
      },
    }));
  }
  function setDayRange(day: Day, field: 'open' | 'close', value: string) {
    setCfg((c) => {
      const cur = c.schedule[day] ?? { open: '09:00', close: '18:00' };
      return { ...c, schedule: { ...c.schedule, [day]: { ...cur, [field]: value } } };
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api('/api/working-hours', {
        method: 'PUT',
        body: {
          enabled: cfg.enabled,
          timezone: cfg.timezone,
          schedule: cfg.schedule,
          oooMessage: cfg.oooMessage,
        },
      });
      mutate();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-semibold">Working hours</h1>
        <p className="text-slate-600 text-sm mt-1">
          Outside the schedule below the auto-reply pipeline either sends your{' '}
          out-of-office message or stays silent. Out-of-office takes priority over both rules and AI.
        </p>
      </header>

      <div className="rounded-lg bg-white border border-slate-200 p-5 space-y-5">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={cfg.enabled}
            onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })}
          />
          <span className="text-sm font-medium">Enable working-hours / out-of-office</span>
        </label>

        <label className="block">
          <span className="text-sm text-slate-700">Timezone</span>
          <input
            list="tz-list"
            value={cfg.timezone}
            onChange={(e) => setCfg({ ...cfg, timezone: e.target.value })}
            placeholder="Africa/Cairo"
            className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            disabled={!cfg.enabled}
          />
          <datalist id="tz-list">
            {COMMON_TZS.map((tz) => (
              <option key={tz} value={tz} />
            ))}
          </datalist>
          <span className="text-xs text-slate-500 mt-1 block">
            IANA timezone (e.g. <code>Africa/Cairo</code>, <code>Asia/Riyadh</code>).
          </span>
        </label>

        <div className="space-y-2">
          <span className="text-sm font-medium">Weekly schedule</span>
          <div className="space-y-1">
            {DAYS.map(({ key, label }) => {
              const range = cfg.schedule[key];
              const isOpen = range != null;
              return (
                <div
                  key={key}
                  className="flex items-center gap-3 py-1.5 border-b border-slate-100 last:border-0"
                >
                  <label className="flex items-center gap-2 w-32">
                    <input
                      type="checkbox"
                      checked={isOpen}
                      onChange={(e) => setDayOpen(key, e.target.checked)}
                      disabled={!cfg.enabled}
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                  {isOpen ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={range.open}
                        onChange={(e) => setDayRange(key, 'open', e.target.value)}
                        className="border border-slate-300 rounded-md px-2 py-1 text-sm"
                        disabled={!cfg.enabled}
                      />
                      <span className="text-slate-500 text-sm">–</span>
                      <input
                        type="time"
                        value={range.close}
                        onChange={(e) => setDayRange(key, 'close', e.target.value)}
                        className="border border-slate-300 rounded-md px-2 py-1 text-sm"
                        disabled={!cfg.enabled}
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400">closed</span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-500">
            If a day&apos;s close time is earlier than its open time it&apos;s treated as
            wrapping past midnight (e.g. 22:00 → 02:00).
          </p>
        </div>

        <label className="block">
          <span className="text-sm text-slate-700">Out-of-office message</span>
          <textarea
            rows={4}
            value={cfg.oooMessage}
            onChange={(e) => setCfg({ ...cfg, oooMessage: e.target.value })}
            placeholder="Thanks for reaching out! Our team is offline right now and will get back to you during business hours."
            className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            disabled={!cfg.enabled}
          />
          <span className="text-xs text-slate-500 mt-1 block">
            Leave blank to <strong>not reply at all</strong> outside working hours.
          </span>
        </label>

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {saved && <span className="text-sm text-emerald-700">Saved.</span>}
          {error && <span className="text-sm text-rose-600">{error}</span>}
        </div>
      </div>
    </div>
  );
}
