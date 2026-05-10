'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { api, swrFetcher } from '@/lib/api';

interface AiConfig {
  enabled: boolean;
  provider: string;
  model: string;
  systemPrompt: string;
  maxTokens: number;
  temperature: number;
  fallbackOnly: boolean;
}
interface AiResponse {
  aiConfig: AiConfig | null;
}

const defaults: AiConfig = {
  enabled: false,
  provider: 'openai',
  model: 'gpt-4o-mini',
  systemPrompt:
    'You are a friendly customer-support assistant for our Facebook page. Reply concisely (max 2 sentences) in the same language as the customer.',
  maxTokens: 300,
  temperature: 0.7,
  fallbackOnly: true,
};

export default function AiPage() {
  const { data, mutate } = useSWR<AiResponse>('/api/ai', swrFetcher);
  const [cfg, setCfg] = useState<AiConfig>(defaults);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data?.aiConfig) setCfg({ ...defaults, ...data.aiConfig });
  }, [data]);

  async function save() {
    setSaved(false);
    await api('/api/ai', { method: 'PUT', body: cfg });
    mutate();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <header>
        <h1 className="text-2xl font-semibold">AI fallback</h1>
        <p className="text-slate-600 text-sm mt-1">
          When no rule matches an incoming message, the AI replies on your behalf.
        </p>
      </header>

      <div className="rounded-lg bg-white border border-slate-200 p-5 space-y-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={cfg.enabled}
            onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })}
          />
          <span className="text-sm">Enable AI fallback</span>
        </label>

        <label className="block">
          <span className="text-sm text-slate-700">Model</span>
          <select
            value={cfg.model}
            onChange={(e) => setCfg({ ...cfg, model: e.target.value })}
            className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
          >
            <option value="gpt-4o-mini">gpt-4o-mini (cheap, fast)</option>
            <option value="gpt-4o">gpt-4o (premium)</option>
            <option value="gpt-4.1-mini">gpt-4.1-mini</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm text-slate-700">System prompt</span>
          <textarea
            rows={5}
            value={cfg.systemPrompt}
            onChange={(e) => setCfg({ ...cfg, systemPrompt: e.target.value })}
            className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm font-mono"
          />
        </label>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm text-slate-700">Max tokens</span>
            <input
              type="number"
              value={cfg.maxTokens}
              onChange={(e) =>
                setCfg({ ...cfg, maxTokens: parseInt(e.target.value || '0', 10) })
              }
              className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-700">Temperature</span>
            <input
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={cfg.temperature}
              onChange={(e) =>
                setCfg({ ...cfg, temperature: parseFloat(e.target.value || '0') })
              }
              className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Save
          </button>
          {saved && <span className="text-sm text-emerald-700">Saved.</span>}
        </div>

        <p className="text-xs text-slate-500">
          Requires <code>OPENAI_API_KEY</code> to be set on the API server.
        </p>
      </div>
    </div>
  );
}
