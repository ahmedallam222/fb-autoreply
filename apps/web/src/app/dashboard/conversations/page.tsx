'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { swrFetcher } from '@/lib/api';

interface ConversationRow {
  id: string;
  channel: 'COMMENT' | 'MESSAGE';
  customerName: string | null;
  status: string;
  lastMessageAt: string;
  page: { name: string };
  _count: { events: number };
}
interface ConversationsResponse {
  conversations: ConversationRow[];
}

export default function ConversationsPage() {
  const { data } = useSWR<ConversationsResponse>('/api/conversations', swrFetcher);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Conversations</h1>
        <p className="text-slate-600 text-sm mt-1">
          Latest customer interactions across all connected pages. Click a row to
          open the full transcript.
        </p>
      </header>
      <div className="rounded-lg bg-white border border-slate-200 divide-y divide-slate-100">
        {data?.conversations.length === 0 && (
          <div className="p-6 text-sm text-slate-500">No conversations yet.</div>
        )}
        {data?.conversations.map((c) => (
          <Link
            key={c.id}
            href={`/dashboard/conversations/${c.id}`}
            className="block p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
          >
            <div>
              <div className="font-medium">{c.customerName ?? 'Anonymous'}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {c.page.name} · {c.channel.toLowerCase()} · {c._count.events} events
              </div>
            </div>
            <div className="text-xs text-slate-500">
              {new Date(c.lastMessageAt).toLocaleString()}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
