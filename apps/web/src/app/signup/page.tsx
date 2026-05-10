'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, setToken } from '@/lib/api';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await api<{ token: string }>('/api/auth/signup', {
        method: 'POST',
        auth: false,
        body: { email, password, name, tenantName },
      });
      setToken(data.token);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={onSubmit}
        className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 w-full max-w-sm space-y-4"
      >
        <h1 className="text-xl font-semibold">Create your workspace</h1>
        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
            {error}
          </div>
        )}
        <Field label="Workspace name" value={tenantName} onChange={setTenantName} required />
        <Field label="Your name" value={name} onChange={setName} />
        <Field label="Email" type="email" value={email} onChange={setEmail} required />
        <Field
          label="Password (min 8 chars)"
          type="password"
          value={password}
          onChange={setPassword}
          required
        />
        <button
          disabled={loading}
          className="w-full bg-brand-500 hover:bg-brand-600 text-white py-2 rounded-md font-medium disabled:opacity-50"
        >
          {loading ? 'Creating…' : 'Create account'}
        </button>
        <p className="text-sm text-slate-600 text-center">
          Already have one?{' '}
          <Link href="/login" className="text-brand-600 hover:underline">
            Login
          </Link>
        </p>
        <p className="text-xs text-slate-500 text-center">
          By creating an account you agree to our{' '}
          <Link href="/terms" className="underline hover:text-slate-700">
            Terms
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="underline hover:text-slate-700">
            Privacy Policy
          </Link>
          .
        </p>
      </form>
    </main>
  );
}

function Field({
  label,
  type = 'text',
  value,
  onChange,
  required,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
    </label>
  );
}
