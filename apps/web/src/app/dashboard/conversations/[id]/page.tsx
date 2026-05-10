'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { swrFetcher } from '@/lib/api';

type Direction = 'INBOUND' | 'OUTBOUND';
type Source = 'RULE' | 'AI' | 'OOO' | 'MANUAL' | 'NONE';
type Kind = 'COMMENT' | 'MESSAGE' | 'PRIVATE_REPLY';

interface ReplyEvent {
  id: string;
  direction: Direction;
  source: Source;
  kind: Kind | null;
  inboundText: string | null;
  outboundText: string | null;
  matchedRuleId: string | null;
  errorMessage: string | null;
  fbMessageId: string | null;
  aiModel: string | null;
  aiPromptTokens: number | null;
  aiCompletionTokens: number | null;
  detectedLanguage: string | null;
  createdAt: string;
}

interface ConversationDetail {
  id: string;
  channel: 'COMMENT' | 'MESSAGE';
  customerName: string | null;
  customerHandle: string | null;
  status: 'OPEN' | 'CLOSED' | 'SNOOZED';
  lastMessageAt: string;
  createdAt: string;
  page: { name: string; fbPageId: string };
  events: ReplyEvent[];
}

interface DetailResponse {
  conversation: ConversationDetail;
}

const SOURCE_LABEL: Record<Source, string> = {
  RULE: 'rule',
  AI: 'AI',
  OOO: 'out-of-office',
  MANUAL: 'manual',
  NONE: 'none',
};

const SOURCE_BADGE: Record<Source, string> = {
  RULE: 'bg-emerald-100 text-emerald-800',
  AI: 'bg-violet-100 text-violet-800',
  OOO: 'bg-amber-100 text-amber-800',
  MANUAL: 'bg-slate-200 text-slate-800',
  NONE: 'bg-slate-100 text-slate-600',
};

function EventCard({ ev }: { ev: ReplyEvent }) {
  const isInbound = ev.direction === 'INBOUND';
  const text = isInbound ? ev.inboundText : ev.outboundText;
  const ts = new Date(ev.createdAt).toLocaleString();

  return (
    <div
      className={`flex ${isInbound ? 'justify-start' : 'justify-end'} px-1`}
    >
      <div
        className={`max-w-[80%] rounded-lg p-3 ${
          isInbound
            ? 'bg-slate-100 text-slate-900'
            : ev.errorMessage
            ? 'bg-rose-50 border border-rose-200 text-slate-900'
            : 'bg-brand-50 border border-brand-100 text-slate-900'
        }`}
      >
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-500 mb-1">
          <span>
            {isInbound
              ? 'Customer'
              : ev.kind === 'PRIVATE_REPLY'
              ? 'Page reply (private DM)'
              : 'Page reply'}
          </span>
          {!isInbound && (
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                SOURCE_BADGE[ev.source]
              }`}
            >
              {SOURCE_LABEL[ev.source]}
            </span>
          )}
          {ev.kind === 'PRIVATE_REPLY' && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-800">
              private reply
            </span>
          )}
          {isInbound && ev.detectedLanguage && (
            <span
              title="Detected inbound language"
              className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-100 text-sky-800 normal-case"
            >
              {ev.detectedLanguage}
            </span>
          )}
          {ev.errorMessage && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-100 text-rose-800">
              error
            </span>
          )}
        </div>
        <div className="whitespace-pre-wrap text-sm">{text ?? <em>(empty)</em>}</div>
        {ev.errorMessage && (
          <div className="mt-2 text-xs text-rose-700 break-words">
            <strong>Error:</strong> {ev.errorMessage}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
          <span>{ts}</span>
          {ev.matchedRuleId && <span>rule: {ev.matchedRuleId}</span>}
          {ev.aiModel && (
            <span>
              {ev.aiModel} · {ev.aiPromptTokens ?? 0} in / {ev.aiCompletionTokens ?? 0} out
            </span>
          )}
          {ev.fbMessageId && <span>msg: {ev.fbMessageId}</span>}
        </div>
      </div>
    </div>
  );
}

export default function ConversationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { data, error, isLoading } = useSWR<DetailResponse>(
    id ? `/api/conversations/${id}` : null,
    swrFetcher,
  );

  if (isLoading) {
    return <div className="text-sm text-slate-500">Loading…</div>;
  }
  if (error || !data) {
    return (
      <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
        Couldn&apos;t load this conversation. It may have been deleted, or you don&apos;t
        have access.{' '}
        <Link href="/dashboard/conversations" className="underline">
          Back to all conversations
        </Link>
      </div>
    );
  }

  const c = data.conversation;
  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/dashboard/conversations"
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          ← All conversations
        </Link>
      </div>
      <header className="rounded-lg bg-white border border-slate-200 p-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-semibold">
              {c.customerName ?? 'Anonymous'}
              {c.customerHandle && (
                <span className="text-slate-500 font-normal text-base ml-2">
                  @{c.customerHandle}
                </span>
              )}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {c.page.name} · {c.channel.toLowerCase()} · {c.events.length} events
            </p>
          </div>
          <div className="text-xs text-slate-500 text-right">
            <div>
              status:{' '}
              <span className="font-medium text-slate-700">
                {c.status.toLowerCase()}
              </span>
            </div>
            <div>started {new Date(c.createdAt).toLocaleString()}</div>
            <div>last activity {new Date(c.lastMessageAt).toLocaleString()}</div>
          </div>
        </div>
      </header>

      <div className="rounded-lg bg-white border border-slate-200 p-4 space-y-3">
        {c.events.length === 0 && (
          <div className="text-sm text-slate-500 px-2 py-4">
            No events recorded for this conversation yet.
          </div>
        )}
        {c.events.map((ev) => (
          <EventCard key={ev.id} ev={ev} />
        ))}
      </div>
    </div>
  );
}
