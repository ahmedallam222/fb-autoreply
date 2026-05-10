'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { swrFetcher } from '@/lib/api';

type Source = 'RULE' | 'AI' | 'MANUAL' | 'NONE';

interface SummaryResponse {
  days: number;
  repliesToday: number;
  replies7d: number;
  replies30d: number;
  window: {
    replies: number;
    inbound: number;
    errors: number;
    conversations: number;
    sourceSplit: Record<Source, number>;
  };
}

interface TimeseriesResponse {
  days: number;
  series: Array<{
    date: string;
    RULE: number;
    AI: number;
    MANUAL: number;
    NONE: number;
    total: number;
  }>;
}

interface TopRulesResponse {
  days: number;
  items: Array<{
    ruleId: string | null;
    name: string;
    priority: number | null;
    enabled: boolean | null;
    count: number;
  }>;
}

interface CostResponse {
  days: number;
  items: Array<{
    model: string;
    replies: number;
    promptTokens: number;
    completionTokens: number;
    costUsd: number;
  }>;
  totals: {
    replies: number;
    promptTokens: number;
    completionTokens: number;
    costUsd: number;
  };
}

const RANGES = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
];

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const q = `?days=${days}`;
  const { data: summary } = useSWR<SummaryResponse>(`/api/analytics/summary${q}`, swrFetcher);
  const { data: timeseries } = useSWR<TimeseriesResponse>(`/api/analytics/timeseries${q}`, swrFetcher);
  const { data: topRules } = useSWR<TopRulesResponse>(`/api/analytics/top-rules${q}`, swrFetcher);
  const { data: cost } = useSWR<CostResponse>(`/api/analytics/cost${q}`, swrFetcher);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="text-slate-600 text-sm mt-1">
            Reply volume, AI vs rule split, top rules, and AI cost.
          </p>
        </div>
        <div className="flex gap-2">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setDays(r.value)}
              className={`text-sm px-3 py-1.5 rounded-md border ${
                days === r.value
                  ? 'bg-brand-50 border-brand-200 text-brand-700 font-medium'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Replies today" value={summary?.repliesToday ?? 0} />
        <Stat label="Replies — last 7 days" value={summary?.replies7d ?? 0} />
        <Stat label="Replies — last 30 days" value={summary?.replies30d ?? 0} />
        <Stat label="Conversations in window" value={summary?.window.conversations ?? 0} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <SourceSplitCard split={summary?.window.sourceSplit} total={summary?.window.replies} />
        <ErrorRateCard
          errors={summary?.window.errors}
          total={summary?.window.replies}
        />
        <CostSummaryCard cost={cost} />
      </div>

      <section className="rounded-lg bg-white border border-slate-200 p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Replies per day</h2>
          <Legend />
        </div>
        <div className="mt-4">
          {timeseries && timeseries.series.length > 0 ? (
            <BarChart series={timeseries.series} />
          ) : (
            <div className="text-sm text-slate-500 py-8 text-center">No data yet.</div>
          )}
        </div>
      </section>

      <section className="rounded-lg bg-white border border-slate-200 p-5">
        <h2 className="font-semibold">Top rules</h2>
        {topRules && topRules.items.length > 0 ? (
          <table className="mt-3 w-full text-sm">
            <thead className="text-xs text-slate-500 text-left">
              <tr>
                <th className="font-medium pb-2">Rule</th>
                <th className="font-medium pb-2">Priority</th>
                <th className="font-medium pb-2">Status</th>
                <th className="font-medium pb-2 text-right">Replies</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {topRules.items.map((row) => (
                <tr key={row.ruleId ?? row.name}>
                  <td className="py-2">{row.name}</td>
                  <td className="py-2 text-slate-600">{row.priority ?? '—'}</td>
                  <td className="py-2">
                    {row.enabled === null ? (
                      <span className="text-xs text-slate-500">—</span>
                    ) : row.enabled ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        Enabled
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        Disabled
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right font-medium">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="mt-3 text-sm text-slate-500">
            No rule replies yet in the selected window.
          </div>
        )}
      </section>

      <section className="rounded-lg bg-white border border-slate-200 p-5">
        <h2 className="font-semibold">AI cost by model</h2>
        <p className="text-xs text-slate-500 mt-1">
          Estimated cost based on OpenAI list prices. See{' '}
          <code>apps/api/src/lib/ai-pricing.ts</code> to update rates.
        </p>
        {cost && cost.items.length > 0 ? (
          <table className="mt-3 w-full text-sm">
            <thead className="text-xs text-slate-500 text-left">
              <tr>
                <th className="font-medium pb-2">Model</th>
                <th className="font-medium pb-2 text-right">Replies</th>
                <th className="font-medium pb-2 text-right">Prompt tokens</th>
                <th className="font-medium pb-2 text-right">Completion tokens</th>
                <th className="font-medium pb-2 text-right">Cost (USD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cost.items.map((row) => (
                <tr key={row.model}>
                  <td className="py-2">{row.model}</td>
                  <td className="py-2 text-right">{row.replies}</td>
                  <td className="py-2 text-right">{row.promptTokens.toLocaleString()}</td>
                  <td className="py-2 text-right">{row.completionTokens.toLocaleString()}</td>
                  <td className="py-2 text-right font-medium">${row.costUsd.toFixed(4)}</td>
                </tr>
              ))}
              <tr className="bg-slate-50">
                <td className="py-2 font-medium">Total</td>
                <td className="py-2 text-right font-medium">{cost.totals.replies}</td>
                <td className="py-2 text-right font-medium">
                  {cost.totals.promptTokens.toLocaleString()}
                </td>
                <td className="py-2 text-right font-medium">
                  {cost.totals.completionTokens.toLocaleString()}
                </td>
                <td className="py-2 text-right font-semibold">
                  ${cost.totals.costUsd.toFixed(4)}
                </td>
              </tr>
            </tbody>
          </table>
        ) : (
          <div className="mt-3 text-sm text-slate-500">
            No AI replies yet in the selected window. Enable AI fallback and add{' '}
            <code>OPENAI_API_KEY</code> on the API server to start using it.
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-lg bg-white border border-slate-200 p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-3xl font-semibold mt-1">{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

function SourceSplitCard({
  split,
  total,
}: {
  split: Record<Source, number> | undefined;
  total: number | undefined;
}) {
  const t = total ?? 0;
  const rule = split?.RULE ?? 0;
  const ai = split?.AI ?? 0;
  const manual = split?.MANUAL ?? 0;
  const pct = (n: number) => (t === 0 ? 0 : Math.round((n / t) * 100));

  return (
    <div className="rounded-lg bg-white border border-slate-200 p-5">
      <div className="text-sm text-slate-500">AI vs Rule split</div>
      <div className="text-3xl font-semibold mt-1">
        {pct(rule)}%<span className="text-base text-slate-400 font-normal"> Rule</span>
      </div>
      <div className="mt-3 flex h-2 rounded-full overflow-hidden bg-slate-100">
        {t > 0 && (
          <>
            <div className="bg-brand-500" style={{ width: `${pct(rule)}%` }} title={`Rule ${rule}`} />
            <div className="bg-violet-500" style={{ width: `${pct(ai)}%` }} title={`AI ${ai}`} />
            <div className="bg-slate-400" style={{ width: `${pct(manual)}%` }} title={`Manual ${manual}`} />
          </>
        )}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-600">
        <div>Rule: <span className="font-medium">{rule}</span></div>
        <div>AI: <span className="font-medium">{ai}</span></div>
        <div>Manual: <span className="font-medium">{manual}</span></div>
      </div>
    </div>
  );
}

function ErrorRateCard({ errors, total }: { errors: number | undefined; total: number | undefined }) {
  const e = errors ?? 0;
  const t = total ?? 0;
  const pct = t === 0 ? 0 : Math.round((e / t) * 100);
  return (
    <div className="rounded-lg bg-white border border-slate-200 p-5">
      <div className="text-sm text-slate-500">Send errors</div>
      <div className="text-3xl font-semibold mt-1">
        {e}
        <span className="text-base text-slate-400 font-normal"> / {t} ({pct}%)</span>
      </div>
      <div className="text-xs text-slate-500 mt-2">
        Outbound replies that failed at the Graph API call (e.g. invalid token, rate limit).
      </div>
    </div>
  );
}

function CostSummaryCard({ cost }: { cost: CostResponse | undefined }) {
  return (
    <div className="rounded-lg bg-white border border-slate-200 p-5">
      <div className="text-sm text-slate-500">Estimated AI cost</div>
      <div className="text-3xl font-semibold mt-1">
        ${(cost?.totals.costUsd ?? 0).toFixed(4)}
      </div>
      <div className="text-xs text-slate-500 mt-2">
        {cost?.totals.replies ?? 0} AI replies ·{' '}
        {(cost?.totals.promptTokens ?? 0).toLocaleString()} +{' '}
        {(cost?.totals.completionTokens ?? 0).toLocaleString()} tokens
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex gap-3 text-xs text-slate-600">
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm bg-brand-500" /> Rule
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm bg-violet-500" /> AI
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm bg-slate-400" /> Manual
      </span>
    </div>
  );
}

function BarChart({ series }: { series: TimeseriesResponse['series'] }) {
  const max = Math.max(1, ...series.map((s) => s.total));
  const W = 720;
  const H = 180;
  const padX = 24;
  const padY = 18;
  const gap = 2;
  const colW = (W - padX * 2) / series.length - gap;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H + 24}`} className="w-full max-w-full" role="img">
        {/* y-axis grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={padX}
            x2={W - padX}
            y1={padY + (H - padY * 2) * (1 - f)}
            y2={padY + (H - padY * 2) * (1 - f)}
            stroke="#e2e8f0"
            strokeWidth={1}
          />
        ))}
        {series.map((s, i) => {
          const x = padX + i * (colW + gap);
          const ruleH = ((s.RULE / max) * (H - padY * 2)) || 0;
          const aiH = ((s.AI / max) * (H - padY * 2)) || 0;
          const manualH = ((s.MANUAL / max) * (H - padY * 2)) || 0;
          const baseY = H - padY;
          let y = baseY;
          return (
            <g key={s.date}>
              {ruleH > 0 && (
                <rect x={x} y={y - ruleH} width={colW} height={ruleH} fill="#3b6ef0">
                  <title>{`${s.date}: Rule ${s.RULE}`}</title>
                </rect>
              )}
              {(() => {
                y -= ruleH;
                return null;
              })()}
              {aiH > 0 && (
                <rect x={x} y={y - aiH} width={colW} height={aiH} fill="#8b5cf6">
                  <title>{`${s.date}: AI ${s.AI}`}</title>
                </rect>
              )}
              {(() => {
                y -= aiH;
                return null;
              })()}
              {manualH > 0 && (
                <rect x={x} y={y - manualH} width={colW} height={manualH} fill="#94a3b8">
                  <title>{`${s.date}: Manual ${s.MANUAL}`}</title>
                </rect>
              )}
            </g>
          );
        })}
        {/* x-axis labels: first, mid, last */}
        {series.length > 0 && (
          <>
            <text x={padX} y={H + 14} fontSize={10} fill="#64748b">
              {series[0]?.date}
            </text>
            <text
              x={W / 2}
              y={H + 14}
              fontSize={10}
              fill="#64748b"
              textAnchor="middle"
            >
              {series[Math.floor(series.length / 2)]?.date}
            </text>
            <text x={W - padX} y={H + 14} fontSize={10} fill="#64748b" textAnchor="end">
              {series[series.length - 1]?.date}
            </text>
          </>
        )}
        {/* y-axis max label */}
        <text x={4} y={padY + 4} fontSize={10} fill="#64748b">
          {max}
        </text>
        <text x={4} y={H - padY + 4} fontSize={10} fill="#64748b">
          0
        </text>
      </svg>
    </div>
  );
}
