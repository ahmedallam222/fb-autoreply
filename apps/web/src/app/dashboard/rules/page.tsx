'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, swrFetcher } from '@/lib/api';

type Channel = 'COMMENT' | 'MESSAGE' | 'BOTH';
type MatchType = 'EXACT' | 'CONTAINS' | 'STARTS_WITH' | 'REGEX';

interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  channel: Channel;
  matchType: MatchType;
  keywords: string[];
  responseTemplate: string;
  priority: number;
  caseSensitive: boolean;
}
interface RulesResponse {
  rules: Rule[];
}

export default function RulesPage() {
  const { data, mutate } = useSWR<RulesResponse>('/api/rules', swrFetcher);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const editing = data?.rules.find((r) => r.id === editingId) ?? null;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Rules</h1>
          <p className="text-slate-600 text-sm mt-1">
            Highest priority match wins. Use simple keyword rules first; fall back to AI for the rest.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setShowForm(true);
          }}
          className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          New rule
        </button>
      </header>

      {(showForm || editing) && (
        <RuleForm
          initial={editing}
          onClose={() => {
            setShowForm(false);
            setEditingId(null);
          }}
          onSaved={() => {
            setShowForm(false);
            setEditingId(null);
            mutate();
          }}
        />
      )}

      <div className="rounded-lg bg-white border border-slate-200 divide-y divide-slate-100">
        {data?.rules.length === 0 && (
          <div className="p-6 text-sm text-slate-500">No rules yet. Create one above.</div>
        )}
        {data?.rules.map((r) => (
          <div key={r.id} className="p-4 flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{r.name}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    r.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {r.enabled ? 'Enabled' : 'Disabled'}
                </span>
                <span className="text-xs text-slate-500">priority {r.priority}</span>
                <span className="text-xs text-slate-500">{r.channel.toLowerCase()}</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Match: {r.matchType.toLowerCase()} · {r.keywords.join(', ')}
              </div>
              <div className="text-sm text-slate-700 mt-2 truncate">{r.responseTemplate}</div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setEditingId(r.id)}
                className="text-sm text-brand-600 hover:underline"
              >
                Edit
              </button>
              <button
                onClick={async () => {
                  if (!confirm('Delete this rule?')) return;
                  await api(`/api/rules/${r.id}`, { method: 'DELETE' });
                  mutate();
                }}
                className="text-sm text-red-600 hover:underline"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RuleForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: Rule | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [keywords, setKeywords] = useState((initial?.keywords ?? []).join(', '));
  const [responseTemplate, setResponseTemplate] = useState(initial?.responseTemplate ?? '');
  const [channel, setChannel] = useState<Channel>(initial?.channel ?? 'BOTH');
  const [matchType, setMatchType] = useState<MatchType>(initial?.matchType ?? 'CONTAINS');
  const [priority, setPriority] = useState(String(initial?.priority ?? 0));
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const payload = {
      name,
      keywords: keywords
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      responseTemplate,
      channel: channel.toLowerCase(),
      matchType: matchType.toLowerCase(),
      priority: parseInt(priority || '0', 10),
      enabled,
      caseSensitive: false,
    };
    try {
      if (initial) {
        await api(`/api/rules/${initial.id}`, { method: 'PUT', body: payload });
      } else {
        await api('/api/rules', { method: 'POST', body: payload });
      }
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-lg bg-white border border-slate-200 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{initial ? 'Edit rule' : 'New rule'}</h2>
        <button type="button" onClick={onClose} className="text-sm text-slate-500">
          Close
        </button>
      </div>
      {err && <div className="text-sm text-red-700">{err}</div>}
      <input
        placeholder="Rule name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
        required
      />
      <input
        placeholder="Keywords (comma separated)"
        value={keywords}
        onChange={(e) => setKeywords(e.target.value)}
        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
        required
      />
      <textarea
        placeholder="Response template (use {{first_name}} for the customer's first name)"
        value={responseTemplate}
        onChange={(e) => setResponseTemplate(e.target.value)}
        rows={4}
        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
        required
      />
      <div className="grid sm:grid-cols-3 gap-3">
        <Select label="Channel" value={channel} onChange={(v) => setChannel(v as Channel)} options={['BOTH', 'COMMENT', 'MESSAGE']} />
        <Select label="Match type" value={matchType} onChange={(v) => setMatchType(v as MatchType)} options={['CONTAINS', 'EXACT', 'STARTS_WITH', 'REGEX']} />
        <label className="block">
          <span className="text-sm text-slate-700">Priority</span>
          <input
            type="number"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Enabled
      </label>
      <div className="flex gap-2">
        <button
          disabled={loading}
          className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Save rule'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="border border-slate-300 hover:bg-slate-100 px-4 py-2 rounded-md text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="text-sm text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
