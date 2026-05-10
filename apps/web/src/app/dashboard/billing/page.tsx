'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, swrFetcher } from '@/lib/api';

type Plan = 'FREE' | 'PRO' | 'BUSINESS';

interface PlanResponse {
  plan: Plan;
  effectivePlan: Plan;
  subscriptionStatus: string | null;
  subscriptionCurrentPeriodEnd: string | null;
  stripeConfigured: boolean;
  limits: { replyLimit: number; pageLimit: number; priceUsd: number };
  usage: { repliesThisMonth: number; connectedPages: number };
  tiers: Array<{
    plan: Plan;
    priceUsd: number;
    replyLimit: number;
    pageLimit: number;
    available: boolean;
  }>;
}

function formatLimit(n: number, unit: string): string {
  if (n < 0) return `unlimited ${unit}`;
  return `${n.toLocaleString()} ${unit}`;
}

function statusLabel(status: string | null): string {
  if (!status) return 'free';
  return status.replace(/_/g, ' ');
}

export default function BillingPage() {
  const { data, mutate } = useSWR<PlanResponse>('/api/billing/plan', swrFetcher);
  const [busy, setBusy] = useState<Plan | 'portal' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(plan: Plan) {
    if (plan === 'FREE') return;
    setBusy(plan);
    setError(null);
    try {
      const r = (await api('/api/billing/checkout', {
        method: 'POST',
        body: {
          plan,
          successUrl: `${window.location.origin}/dashboard/billing?status=success`,
          cancelUrl: `${window.location.origin}/dashboard/billing?status=cancel`,
        },
      })) as { url: string };
      window.location.href = r.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
      setBusy(null);
    }
  }

  async function openPortal() {
    setBusy('portal');
    setError(null);
    try {
      const r = (await api('/api/billing/portal', {
        method: 'POST',
        body: { returnUrl: `${window.location.origin}/dashboard/billing` },
      })) as { url: string };
      window.location.href = r.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
      setBusy(null);
    }
  }

  if (!data) {
    return <div className="text-sm text-slate-500">Loading…</div>;
  }

  const usagePct =
    data.limits.replyLimit < 0
      ? 0
      : Math.min(100, Math.round((data.usage.repliesThisMonth / Math.max(1, data.limits.replyLimit)) * 100));

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-semibold">Billing &amp; usage</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your subscription, see this month&apos;s usage, and switch plans.
        </p>
      </header>

      {!data.stripeConfigured && (
        <div className="px-4 py-2 rounded-md border border-amber-300 bg-amber-50 text-amber-900 text-sm">
          Stripe is not configured on this server, so checkout and the customer
          portal are disabled. Set <code>STRIPE_SECRET_KEY</code>,{' '}
          <code>STRIPE_WEBHOOK_SECRET</code>,{' '}
          <code>STRIPE_PRICE_ID_PRO</code> and{' '}
          <code>STRIPE_PRICE_ID_BUSINESS</code> in the API env to enable
          billing. The plan-limit enforcement (free tier {formatLimit(data.limits.replyLimit, 'replies/mo')})
          is still active.
        </div>
      )}

      {error && (
        <div className="px-4 py-2 rounded-md border border-red-300 bg-red-50 text-red-800 text-sm">
          {error}
        </div>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase text-slate-500 tracking-wider">Current plan</div>
            <div className="text-2xl font-semibold mt-1">{data.effectivePlan}</div>
            <div className="text-xs text-slate-500 mt-1">
              Stripe status: <span className="font-mono">{statusLabel(data.subscriptionStatus)}</span>
              {data.subscriptionCurrentPeriodEnd && (
                <>
                  {' · renews '}
                  <span className="font-mono">
                    {new Date(data.subscriptionCurrentPeriodEnd).toLocaleDateString()}
                  </span>
                </>
              )}
            </div>
          </div>
          {data.plan !== 'FREE' && data.stripeConfigured && (
            <button
              onClick={openPortal}
              disabled={busy === 'portal'}
              className="text-sm border border-slate-300 rounded-md px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50"
            >
              {busy === 'portal' ? 'Opening…' : 'Manage subscription'}
            </button>
          )}
        </div>

        <div>
          <div className="flex justify-between text-sm">
            <span>Replies this month</span>
            <span className="font-mono">
              {data.usage.repliesThisMonth.toLocaleString()} /{' '}
              {data.limits.replyLimit < 0 ? '∞' : data.limits.replyLimit.toLocaleString()}
            </span>
          </div>
          <div className="mt-1 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${usagePct >= 90 ? 'bg-red-500' : usagePct >= 70 ? 'bg-amber-500' : 'bg-brand-500'}`}
              style={{ width: `${data.limits.replyLimit < 0 ? 0 : usagePct}%` }}
            />
          </div>
          {data.limits.replyLimit > 0 && data.usage.repliesThisMonth >= data.limits.replyLimit && (
            <div className="text-xs text-red-700 mt-1">
              You&apos;ve hit this month&apos;s limit. New incoming events
              won&apos;t be auto-replied to until next month — or upgrade below.
            </div>
          )}
        </div>

        <div className="flex justify-between text-sm">
          <span>Connected pages</span>
          <span className="font-mono">
            {data.usage.connectedPages.toLocaleString()} /{' '}
            {data.limits.pageLimit < 0 ? '∞' : data.limits.pageLimit.toLocaleString()}
          </span>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Plans</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {data.tiers.map((tier) => {
            const isCurrent = tier.plan === data.effectivePlan;
            const upgradeable = tier.plan !== 'FREE' && tier.available && !isCurrent;
            return (
              <div
                key={tier.plan}
                className={`rounded-lg border p-4 flex flex-col ${
                  isCurrent ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="text-sm font-semibold">{tier.plan}</div>
                <div className="text-2xl font-semibold mt-1">
                  {tier.priceUsd === 0 ? 'Free' : `$${tier.priceUsd}`}
                  {tier.priceUsd > 0 && (
                    <span className="text-sm font-normal text-slate-500"> /mo</span>
                  )}
                </div>
                <ul className="text-sm text-slate-600 mt-3 space-y-1 flex-1">
                  <li>{formatLimit(tier.replyLimit, 'replies / month')}</li>
                  <li>{formatLimit(tier.pageLimit, 'connected pages')}</li>
                  <li>AI fallback included</li>
                </ul>
                {isCurrent ? (
                  <div className="mt-4 text-xs text-brand-700 font-medium">Current plan</div>
                ) : upgradeable ? (
                  <button
                    onClick={() => startCheckout(tier.plan)}
                    disabled={busy === tier.plan || !data.stripeConfigured}
                    className="mt-4 text-sm bg-brand-600 text-white rounded-md py-2 disabled:opacity-50 hover:bg-brand-700"
                  >
                    {busy === tier.plan ? 'Opening checkout…' : `Upgrade to ${tier.plan}`}
                  </button>
                ) : tier.plan === 'FREE' ? (
                  <div className="mt-4 text-xs text-slate-500">Default plan for new tenants.</div>
                ) : (
                  <div className="mt-4 text-xs text-slate-500">
                    Not available — Stripe price ID not configured for {tier.plan}.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
