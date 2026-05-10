'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, swrFetcher } from '@/lib/api';

interface ConnectedPage {
  id: string;
  fbPageId: string;
  name: string;
  category: string | null;
  webhookSubscribed: boolean;
  connectedAt: string;
}
interface PagesResponse {
  pages: ConnectedPage[];
}

export default function PagesPage() {
  const { data, mutate } = useSWR<PagesResponse>('/api/pages', swrFetcher);
  const [showManual, setShowManual] = useState(false);

  async function startOAuth() {
    try {
      const r = await api<{ url: string }>('/api/pages/oauth/url');
      window.location.href = r.url;
    } catch (err) {
      alert(err instanceof Error ? err.message : 'OAuth not configured');
    }
  }

  async function disconnect(id: string) {
    if (!confirm('Disconnect this page?')) return;
    await api(`/api/pages/${id}`, { method: 'DELETE' });
    mutate();
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Connected pages</h1>
          <p className="text-slate-600 text-sm mt-1">
            Pages here will receive auto-replies for comments and Messenger DMs.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowManual((s) => !s)}
            className="border border-slate-300 hover:bg-slate-100 px-3 py-2 rounded-md text-sm"
          >
            {showManual ? 'Hide manual' : 'Manual connect'}
          </button>
          <button
            onClick={startOAuth}
            className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Connect with Facebook
          </button>
        </div>
      </header>

      {showManual && <ManualConnectForm onConnected={() => mutate()} />}

      <div className="rounded-lg bg-white border border-slate-200 divide-y divide-slate-100">
        {data?.pages.length === 0 && (
          <div className="p-6 text-sm text-slate-500">No pages connected yet.</div>
        )}
        {data?.pages.map((p) => (
          <div key={p.id} className="p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                ID: {p.fbPageId} · {p.category ?? 'Unknown category'}
              </div>
              <div
                className={`text-xs mt-1 ${
                  p.webhookSubscribed ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {p.webhookSubscribed ? 'Webhook subscribed' : 'Webhook not subscribed'}
              </div>
            </div>
            <button
              onClick={() => disconnect(p.id)}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Disconnect
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ManualConnectForm({ onConnected }: { onConnected: () => void }) {
  const [pageId, setPageId] = useState('');
  const [pageName, setPageName] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await api('/api/pages/manual', {
        method: 'POST',
        body: { pageId, pageName, pageAccessToken: token },
      });
      setPageId('');
      setPageName('');
      setToken('');
      onConnected();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-lg bg-white border border-slate-200 p-5 space-y-3"
    >
      <h2 className="font-semibold text-sm">Manual page connect</h2>
      <p className="text-xs text-slate-500">
        Use this in development. Get a long-lived Page Access Token from the Graph API Explorer.
      </p>
      {err && <div className="text-sm text-red-700">{err}</div>}
      <div className="grid sm:grid-cols-2 gap-3">
        <input
          placeholder="Page ID"
          value={pageId}
          onChange={(e) => setPageId(e.target.value)}
          className="border border-slate-300 rounded-md px-3 py-2 text-sm"
          required
        />
        <input
          placeholder="Page name"
          value={pageName}
          onChange={(e) => setPageName(e.target.value)}
          className="border border-slate-300 rounded-md px-3 py-2 text-sm"
          required
        />
      </div>
      <input
        placeholder="Page Access Token"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
        required
      />
      <button
        disabled={loading}
        className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
      >
        {loading ? 'Connecting…' : 'Connect page'}
      </button>
    </form>
  );
}
