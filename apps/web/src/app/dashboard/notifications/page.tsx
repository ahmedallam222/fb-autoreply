'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { api, swrFetcher } from '@/lib/api';

interface Prefs {
  errorAlertsEnabled: boolean;
  dailyDigestEnabled: boolean;
  recipientOverride: string;
  smtpConfigured: boolean;
  lastErrorAlertAt?: string | null;
  lastDailyDigestSentAt?: string | null;
}

const DEFAULT: Prefs = {
  errorAlertsEnabled: true,
  dailyDigestEnabled: true,
  recipientOverride: '',
  smtpConfigured: false,
};

function formatTs(ts: string | null | undefined): string {
  if (!ts) return 'never';
  return new Date(ts).toLocaleString();
}

export default function NotificationsPage() {
  const { data, mutate } = useSWR<Prefs>('/api/notifications', swrFetcher);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data) setPrefs({ ...DEFAULT, ...data });
  }, [data]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api('/api/notifications', {
        method: 'PUT',
        body: {
          errorAlertsEnabled: prefs.errorAlertsEnabled,
          dailyDigestEnabled: prefs.dailyDigestEnabled,
          recipientOverride: prefs.recipientOverride,
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

  async function sendTest() {
    setTesting(true);
    setTestMsg(null);
    try {
      const r = (await api('/api/notifications/test', { method: 'POST' })) as {
        ok: boolean;
        recipients: string[];
      };
      setTestMsg(`Sent to ${r.recipients.join(', ')}`);
    } catch (e) {
      setTestMsg(e instanceof Error ? e.message : 'failed');
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <header>
        <h1 className="text-2xl font-semibold">Email notifications</h1>
        <p className="text-slate-600 text-sm mt-1">
          Get an email when something looks wrong, plus an optional daily summary.
          By default we email every owner of this workspace.
        </p>
      </header>

      {!prefs.smtpConfigured && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>SMTP is not configured</strong> on the API server. Notifications are
          still recorded but emails won&apos;t actually be sent. Set the{' '}
          <code>SMTP_HOST</code> / <code>SMTP_USER</code> / <code>SMTP_PASS</code>{' '}
          env vars on the API to enable delivery.
        </div>
      )}

      <div className="rounded-lg bg-white border border-slate-200 p-5 space-y-5">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={prefs.errorAlertsEnabled}
            onChange={(e) =>
              setPrefs({ ...prefs, errorAlertsEnabled: e.target.checked })
            }
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-medium">Error-spike alert</span>
            <span className="block text-xs text-slate-500 mt-0.5">
              Email when ≥30% of outbound replies in the last hour fail (with at
              least 10 attempts). Cooldown of 1 hour between alerts.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={prefs.dailyDigestEnabled}
            onChange={(e) =>
              setPrefs({ ...prefs, dailyDigestEnabled: e.target.checked })
            }
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-medium">Daily digest</span>
            <span className="block text-xs text-slate-500 mt-0.5">
              One email per day (around 09:00 UTC) summarising replies sent,
              errors, top rules, and AI cost over the last 24 hours.
            </span>
          </span>
        </label>

        <label className="block">
          <span className="text-sm text-slate-700">Recipient override</span>
          <input
            type="text"
            value={prefs.recipientOverride}
            onChange={(e) => setPrefs({ ...prefs, recipientOverride: e.target.value })}
            placeholder="optional — comma-separated emails"
            className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
          <span className="text-xs text-slate-500 mt-1 block">
            Leave blank to send to every workspace owner. Otherwise we&apos;ll use
            this list verbatim.
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
          <button
            onClick={sendTest}
            disabled={testing || !prefs.smtpConfigured}
            className="border border-slate-300 hover:bg-slate-100 px-4 py-2 rounded-md text-sm disabled:opacity-50"
          >
            {testing ? 'Sending…' : 'Send test email'}
          </button>
          {saved && <span className="text-sm text-emerald-700">Saved.</span>}
          {error && <span className="text-sm text-rose-600">{error}</span>}
        </div>

        {testMsg && (
          <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
            {testMsg}
          </p>
        )}
      </div>

      <div className="rounded-lg bg-white border border-slate-200 p-5 text-sm text-slate-600 space-y-1">
        <div>Last error alert sent: <strong>{formatTs(prefs.lastErrorAlertAt)}</strong></div>
        <div>Last daily digest sent: <strong>{formatTs(prefs.lastDailyDigestSentAt)}</strong></div>
      </div>
    </div>
  );
}
