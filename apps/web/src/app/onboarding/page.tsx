'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { api, getToken, swrFetcher } from '@/lib/api';

interface MeResponse {
  user: { email: string; name: string | null };
  tenant: { id: string; name: string; onboardedAt: string | null };
}

interface RuleTemplate {
  key: string;
  name: string;
  channel: string;
  matchType: string;
  keywords: string[];
  responseTemplate: string;
  priority: number;
  description: string;
}

interface TemplatesResponse {
  templates: RuleTemplate[];
}

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

const STEPS = ['Welcome', 'Connect a page', 'Pick rule presets', 'Enable AI fallback'] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!getToken()) router.replace('/login');
  }, [router]);

  const { data: me } = useSWR<MeResponse>('/api/auth/me', swrFetcher);

  // If the user is already onboarded, send them to the dashboard.
  useEffect(() => {
    if (me?.tenant.onboardedAt) router.replace('/dashboard');
  }, [me, router]);

  async function finish() {
    await api('/api/auth/complete-onboarding', { method: 'POST' });
    router.replace('/dashboard');
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-start justify-center py-10 px-4">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-brand-700">fb-autoreply</h1>
          <button
            onClick={finish}
            className="text-sm text-slate-500 hover:text-slate-700 underline"
            title="Skip the wizard and go to the dashboard. You can always set things up manually."
          >
            Skip onboarding
          </button>
        </div>

        <Stepper step={step} />

        <div className="mt-6 rounded-lg bg-white border border-slate-200 p-6">
          {step === 0 && <StepWelcome me={me} onNext={() => setStep(1)} />}
          {step === 1 && (
            <StepConnectPage onNext={() => setStep(2)} onBack={() => setStep(0)} />
          )}
          {step === 2 && (
            <StepRulePresets onNext={() => setStep(3)} onBack={() => setStep(1)} />
          )}
          {step === 3 && <StepAiFallback onFinish={finish} onBack={() => setStep(2)} />}
        </div>
      </div>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <li key={label} className="flex-1">
            <div
              className={`text-xs font-medium ${
                active ? 'text-brand-700' : done ? 'text-emerald-700' : 'text-slate-500'
              }`}
            >
              Step {i + 1}
            </div>
            <div
              className={`mt-1 h-1.5 rounded-full ${
                active ? 'bg-brand-500' : done ? 'bg-emerald-500' : 'bg-slate-200'
              }`}
            />
            <div className="mt-1 text-xs text-slate-600">{label}</div>
          </li>
        );
      })}
    </ol>
  );
}

function StepWelcome({ me, onNext }: { me: MeResponse | undefined; onNext: () => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">
        Welcome{me?.user.name ? `, ${me.user.name.split(' ')[0]}` : ''}.
      </h2>
      <p className="text-slate-700">
        Workspace: <span className="font-medium">{me?.tenant.name ?? '…'}</span>
      </p>
      <p className="text-slate-600 text-sm">
        We&rsquo;ll walk you through 3 quick steps to get auto-reply running on a Facebook
        page. Each step is optional &mdash; you can skip and come back later.
      </p>
      <ul className="text-sm text-slate-700 list-disc list-inside space-y-1">
        <li>Connect a Facebook page (manual or via Facebook OAuth)</li>
        <li>Import a few starter rules so common questions get instant replies</li>
        <li>Optionally enable AI fallback for messages that don&rsquo;t match any rule</li>
      </ul>
      <div className="pt-2 flex justify-end">
        <PrimaryButton onClick={onNext}>Let&rsquo;s start</PrimaryButton>
      </div>
    </div>
  );
}

function StepConnectPage({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { data: pages } = useSWR<{ pages: Array<{ id: string; name: string }> }>(
    '/api/pages',
    swrFetcher,
  );
  const [showManual, setShowManual] = useState(false);
  const [pageId, setPageId] = useState('');
  const [pageName, setPageName] = useState('');
  const [token, setToken] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const connected = pages?.pages ?? [];

  async function startOAuth() {
    setErr(null);
    try {
      const r = await api<{ url: string }>('/api/pages/oauth/url');
      window.location.href = r.url;
    } catch (e) {
      setErr(
        e instanceof Error
          ? e.message === 'fb_app_not_configured'
            ? 'Facebook OAuth is not configured yet (FB_APP_ID missing on the API server). Use Manual connect for now.'
            : e.message
          : 'OAuth failed.',
      );
    }
  }

  async function manualConnect(e: React.FormEvent) {
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
      setShowManual(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not connect the page.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Connect a Facebook page</h2>
      <p className="text-slate-600 text-sm">
        Auto-replies are sent on behalf of pages you connect here. Connect at least one to
        start replying.
      </p>

      {connected.length > 0 ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
          <div className="text-sm text-emerald-900 font-medium">
            {connected.length} page{connected.length === 1 ? '' : 's'} already connected
          </div>
          <ul className="mt-1 text-xs text-emerald-800 list-disc list-inside">
            {connected.map((p) => (
              <li key={p.id}>{p.name}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          You haven&rsquo;t connected a page yet. You can skip this step and come back from
          the Pages tab later.
        </div>
      )}

      {err && <div className="text-sm text-red-700">{err}</div>}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={startOAuth}
          className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          Connect with Facebook
        </button>
        <button
          onClick={() => setShowManual((s) => !s)}
          className="border border-slate-300 hover:bg-slate-100 px-3 py-2 rounded-md text-sm"
        >
          {showManual ? 'Hide manual connect' : 'Manual connect (dev)'}
        </button>
      </div>

      {showManual && (
        <form
          onSubmit={manualConnect}
          className="rounded-md border border-slate-200 p-4 space-y-3"
        >
          <p className="text-xs text-slate-500">
            Use this in development. Get a long-lived Page Access Token from the Graph API
            Explorer.
          </p>
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
            type="submit"
            disabled={loading}
            className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-md text-sm"
          >
            {loading ? 'Connecting…' : 'Connect manually'}
          </button>
        </form>
      )}

      <Footer onBack={onBack} onNext={onNext} primaryLabel="Continue" />
    </div>
  );
}

function StepRulePresets({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { data, mutate } = useSWR<TemplatesResponse>('/api/rules/templates', swrFetcher);
  const { data: rulesData } = useSWR<{ rules: Array<{ name: string }> }>(
    '/api/rules',
    swrFetcher,
  );
  const [selected, setSelected] = useState<Set<string>>(
    new Set(['pricing', 'hours', 'greeting']),
  );
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  const existingNames = new Set((rulesData?.rules ?? []).map((r) => r.name));

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function importSelected() {
    if (!data) return;
    setErr(null);
    setImporting(true);
    let count = 0;
    try {
      for (const tpl of data.templates) {
        if (!selected.has(tpl.key)) continue;
        if (existingNames.has(tpl.name)) continue; // avoid dup on retry
        await api('/api/rules', {
          method: 'POST',
          body: {
            name: tpl.name,
            keywords: tpl.keywords,
            responseTemplate: tpl.responseTemplate,
            channel: tpl.channel,
            matchType: tpl.matchType,
            priority: tpl.priority,
            enabled: true,
            caseSensitive: false,
          },
        });
        count++;
      }
      setImported(count);
      await mutate();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not import templates.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Pick a few starter rules</h2>
      <p className="text-slate-600 text-sm">
        We pre-wrote a few common reply templates. Pick the ones that fit your business
        and import them &mdash; you can always edit, disable, or delete them later.
      </p>

      <div className="space-y-2">
        {data?.templates.map((tpl) => {
          const checked = selected.has(tpl.key);
          const already = existingNames.has(tpl.name);
          return (
            <label
              key={tpl.key}
              className={`block rounded-md border p-3 cursor-pointer ${
                checked
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-slate-200 hover:border-slate-300'
              } ${already ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(tpl.key)}
                  disabled={already}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{tpl.name}</span>
                    <span className="text-xs text-slate-500">priority {tpl.priority}</span>
                    {already && (
                      <span className="text-xs text-slate-500 italic">
                        already imported
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Keywords: {tpl.keywords.slice(0, 5).join(', ')}
                    {tpl.keywords.length > 5 ? '…' : ''}
                  </div>
                  <div className="text-sm text-slate-700 mt-1">
                    &ldquo;{tpl.responseTemplate}&rdquo;
                  </div>
                </div>
              </div>
            </label>
          );
        })}
      </div>

      {err && <div className="text-sm text-red-700">{err}</div>}
      {imported > 0 && (
        <div className="text-sm text-emerald-700">
          Imported {imported} rule{imported === 1 ? '' : 's'}.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={importSelected}
          disabled={importing || selected.size === 0}
          className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-md text-sm"
        >
          {importing
            ? 'Importing…'
            : `Import ${selected.size} selected`}
        </button>
      </div>

      <Footer onBack={onBack} onNext={onNext} primaryLabel="Continue" />
    </div>
  );
}

function StepAiFallback({ onFinish, onBack }: { onFinish: () => void; onBack: () => void }) {
  const { data, mutate } = useSWR<AiResponse>('/api/ai', swrFetcher);
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (data?.aiConfig) setEnabled(data.aiConfig.enabled);
  }, [data]);

  async function saveAndFinish() {
    setErr(null);
    setSaving(true);
    try {
      await api('/api/ai', {
        method: 'PUT',
        body: { ...(data?.aiConfig ?? {}), enabled },
      });
      await mutate();
      onFinish();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save AI config.');
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Enable AI fallback (optional)</h2>
      <p className="text-slate-600 text-sm">
        When a customer message doesn&rsquo;t match any of your rules, AI fallback can
        generate a friendly reply. You stay in control of the system prompt and can
        disable this anytime.
      </p>

      <label className="flex items-start gap-3 rounded-md border border-slate-200 p-3 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-1"
        />
        <div>
          <div className="font-medium">Enable AI fallback</div>
          <div className="text-xs text-slate-500 mt-0.5">
            Requires <code>OPENAI_API_KEY</code> to be set on the API server. You can fine-tune
            the model, system prompt, and limits from the AI fallback tab.
          </div>
        </div>
      </label>

      <div className="rounded-md bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
        Tip: leave this off for now and turn it on once you&rsquo;ve verified your keyword
        rules work the way you expect. AI replies cost real money &mdash; the Analytics tab
        shows your estimated spend.
      </div>

      {err && <div className="text-sm text-red-700">{err}</div>}

      <div className="flex justify-between pt-2">
        <button
          onClick={onBack}
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          ← Back
        </button>
        <button
          onClick={saveAndFinish}
          disabled={saving}
          className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          {saving ? 'Finishing…' : 'Finish & go to dashboard'}
        </button>
      </div>
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium"
    >
      {children}
    </button>
  );
}

function Footer({
  onBack,
  onNext,
  primaryLabel,
}: {
  onBack: () => void;
  onNext: () => void;
  primaryLabel: string;
}) {
  return (
    <div className="flex justify-between pt-2">
      <button onClick={onBack} className="text-sm text-slate-600 hover:text-slate-900">
        ← Back
      </button>
      <PrimaryButton onClick={onNext}>{primaryLabel} →</PrimaryButton>
    </div>
  );
}
