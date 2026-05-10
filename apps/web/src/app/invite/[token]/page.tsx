'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface InvitePreview {
  email: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  tenantName: string;
  expiresAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const router = useRouter();

  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/team/invites/${token}`)
      .then(async (r) => {
        if (!r.ok) {
          const err = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error ?? `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((data: InvitePreview) => setInvite(data))
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : 'failed'))
      .finally(() => setLoading(false));
  }, [token]);

  async function accept(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const r = await fetch(`${API_URL}/api/team/invites/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, name: name.trim() || undefined }),
      });
      if (!r.ok) {
        const err = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `HTTP ${r.status}`);
      }
      const data = (await r.json()) as { token: string };
      // Persist the JWT under the same key the rest of the app uses
      // (see apps/web/src/lib/api.ts).
      localStorage.setItem('fb-autoreply-token', data.token);
      router.push('/dashboard');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-slate-500">Loading invite…</p>
      </main>
    );
  }

  if (loadError || !invite) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-semibold">Invite not valid</h1>
          <p className="text-sm text-slate-600">
            This invite link has expired or has already been used. Ask whoever
            sent it to send a new one.
          </p>
          <Link
            href="/login"
            className="inline-block text-sm text-brand-600 hover:underline"
          >
            Go to login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <header className="text-center">
          <h1 className="text-2xl font-semibold">
            Join {invite.tenantName}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            You&apos;ve been invited as a <strong>{invite.role.toLowerCase()}</strong>.
            Set a password to finish creating your account.
          </p>
        </header>

        <form
          onSubmit={accept}
          className="rounded-lg bg-white border border-slate-200 p-5 space-y-4"
        >
          <label className="block">
            <span className="text-xs text-slate-600">Email</span>
            <input
              type="email"
              value={invite.email}
              disabled
              className="mt-1 w-full border border-slate-200 bg-slate-50 rounded-md px-3 py-2 text-sm text-slate-700"
            />
          </label>

          <label className="block">
            <span className="text-xs text-slate-600">Your name (optional)</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-xs text-slate-600">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">
              At least 8 characters.
            </span>
          </label>

          {submitError && (
            <p className="text-sm text-rose-600">{submitError}</p>
          )}

          <button
            type="submit"
            disabled={submitting || password.length < 8}
            className="w-full bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-60"
          >
            {submitting ? 'Joining…' : 'Accept invite'}
          </button>
        </form>
      </div>
    </main>
  );
}
