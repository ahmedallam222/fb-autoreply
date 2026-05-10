'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, swrFetcher } from '@/lib/api';

type Role = 'OWNER' | 'ADMIN' | 'MEMBER';

interface Member {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  createdAt: string;
}
interface PendingInvite {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
  createdAt: string;
}
interface TeamResponse {
  members: Member[];
  pendingInvites: PendingInvite[];
}

const ROLE_BADGE: Record<Role, string> = {
  OWNER: 'bg-emerald-100 text-emerald-800',
  ADMIN: 'bg-violet-100 text-violet-800',
  MEMBER: 'bg-slate-100 text-slate-700',
};

interface MeResponse {
  user: { id: string; role: Role };
}

export default function TeamPage() {
  const { data: team, mutate } = useSWR<TeamResponse>('/api/team', swrFetcher);
  const { data: me } = useSWR<MeResponse>('/api/auth/me', swrFetcher);
  const myRole = me?.user.role;
  const myUserId = me?.user.id;
  const isOwner = myRole === 'OWNER';
  const canInvite = myRole === 'OWNER' || myRole === 'ADMIN';

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('MEMBER');
  const [inviting, setInviting] = useState(false);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [lastInviteEmailSent, setLastInviteEmailSent] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function invite() {
    setInviting(true);
    setError(null);
    setLastInviteUrl(null);
    try {
      const r = (await api('/api/team/invites', {
        method: 'POST',
        body: { email: inviteEmail.trim(), role: inviteRole },
      })) as { acceptUrl: string; emailDelivered: boolean };
      setLastInviteUrl(r.acceptUrl);
      setLastInviteEmailSent(r.emailDelivered);
      setInviteEmail('');
      mutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setInviting(false);
    }
  }

  async function revokeInvite(id: string) {
    try {
      await api(`/api/team/invites/${id}`, { method: 'DELETE' });
      mutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    }
  }

  async function changeRole(userId: string, role: Role) {
    try {
      await api(`/api/team/members/${userId}`, { method: 'PATCH', body: { role } });
      mutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    }
  }

  async function removeMember(userId: string) {
    if (!confirm('Remove this member from the workspace?')) return;
    try {
      await api(`/api/team/members/${userId}`, { method: 'DELETE' });
      mutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-semibold">Team</h1>
        <p className="text-slate-600 text-sm mt-1">
          Invite teammates and decide what they can do. Owners can change roles
          and remove members; admins can invite new people; members have read
          + edit access on rules and conversations.
        </p>
      </header>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {error}
        </div>
      )}

      {canInvite && (
        <section className="rounded-lg bg-white border border-slate-200 p-5">
          <h2 className="text-sm font-medium text-slate-900">Invite a teammate</h2>
          <div className="mt-3 flex flex-wrap gap-2 items-end">
            <label className="flex-1 min-w-[200px]">
              <span className="text-xs text-slate-600">Email</span>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@example.com"
                className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </label>
            <label>
              <span className="text-xs text-slate-600">Role</span>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
                className="mt-1 border border-slate-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
                {isOwner && <option value="OWNER">Owner</option>}
              </select>
            </label>
            <button
              onClick={invite}
              disabled={inviting || !inviteEmail.trim()}
              className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-60"
            >
              {inviting ? 'Sending…' : 'Send invite'}
            </button>
          </div>

          {lastInviteUrl && (
            <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 break-all">
              <div className="text-slate-600 mb-1">
                {lastInviteEmailSent
                  ? 'Invite email sent. They can also use this link:'
                  : "SMTP isn't configured, so we couldn't send the invite email. Share this link directly:"}
              </div>
              <a href={lastInviteUrl} className="text-brand-600 hover:underline">
                {lastInviteUrl}
              </a>
            </div>
          )}
        </section>
      )}

      <section className="rounded-lg bg-white border border-slate-200">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-900">Members</h2>
          <span className="text-xs text-slate-500">
            {team?.members.length ?? 0} total
          </span>
        </div>
        <ul className="divide-y divide-slate-100">
          {team?.members.map((m) => {
            const isMe = m.id === myUserId;
            return (
              <li key={m.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {m.name ?? m.email}
                    {isMe && <span className="text-slate-400 text-xs ml-2">(you)</span>}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{m.email}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isOwner && !isMe ? (
                    <select
                      value={m.role}
                      onChange={(e) => changeRole(m.id, e.target.value as Role)}
                      className={`text-xs font-medium border-0 rounded px-2 py-0.5 ${ROLE_BADGE[m.role]}`}
                    >
                      <option value="MEMBER">Member</option>
                      <option value="ADMIN">Admin</option>
                      <option value="OWNER">Owner</option>
                    </select>
                  ) : (
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${ROLE_BADGE[m.role]}`}
                    >
                      {m.role.toLowerCase()}
                    </span>
                  )}
                  {isOwner && !isMe && (
                    <button
                      onClick={() => removeMember(m.id)}
                      className="text-xs text-rose-600 hover:text-rose-800"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {(team?.pendingInvites?.length ?? 0) > 0 && (
        <section className="rounded-lg bg-white border border-slate-200">
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="text-sm font-medium text-slate-900">Pending invites</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {team?.pendingInvites.map((inv) => (
              <li key={inv.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{inv.email}</div>
                  <div className="text-xs text-slate-500">
                    expires {new Date(inv.expiresAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${ROLE_BADGE[inv.role]}`}
                  >
                    {inv.role.toLowerCase()}
                  </span>
                  {canInvite && (
                    <button
                      onClick={() => revokeInvite(inv.id)}
                      className="text-xs text-rose-600 hover:text-rose-800"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
