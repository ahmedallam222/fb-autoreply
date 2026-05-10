'use client';

import useSWR from 'swr';
import { swrFetcher } from '@/lib/api';

interface MeResponse {
  user: { email: string; name: string | null };
  tenant: { id: string; name: string };
}
interface PagesResponse {
  pages: Array<{ id: string; name: string; webhookSubscribed: boolean }>;
}
interface RulesResponse {
  rules: Array<{ id: string; name: string; enabled: boolean }>;
}

export default function DashboardOverviewPage() {
  const { data: me } = useSWR<MeResponse>('/api/auth/me', swrFetcher);
  const { data: pages } = useSWR<PagesResponse>('/api/pages', swrFetcher);
  const { data: rules } = useSWR<RulesResponse>('/api/rules', swrFetcher);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">
          Welcome{me?.user.name ? `, ${me.user.name}` : ''}.
        </h1>
        {me && (
          <p className="text-slate-600 text-sm mt-1">
            Workspace: <span className="font-medium">{me.tenant.name}</span>
          </p>
        )}
      </header>

      <div className="grid sm:grid-cols-3 gap-4">
        <Stat
          label="Connected pages"
          value={pages?.pages.length ?? 0}
          hint={
            pages && pages.pages.some((p) => !p.webhookSubscribed)
              ? 'Some pages aren\u2019t subscribed yet'
              : undefined
          }
        />
        <Stat
          label="Active rules"
          value={rules?.rules.filter((r) => r.enabled).length ?? 0}
        />
        <Stat label="Total rules" value={rules?.rules.length ?? 0} />
      </div>

      <section className="rounded-lg bg-white border border-slate-200 p-5">
        <h2 className="font-semibold">Quick start</h2>
        <ol className="mt-3 list-decimal list-inside text-sm text-slate-700 space-y-1">
          <li>Connect your Facebook page from the Pages tab.</li>
          <li>Add at least one rule to handle common questions.</li>
          <li>(Optional) Enable AI fallback for unmatched messages.</li>
          <li>Test by commenting on your page or DMing it.</li>
        </ol>
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-lg bg-white border border-slate-200 p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-3xl font-semibold mt-1">{value}</div>
      {hint && <div className="text-xs text-amber-700 mt-1">{hint}</div>}
    </div>
  );
}
