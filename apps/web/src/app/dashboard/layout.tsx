'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { clearToken, getToken } from '@/lib/api';

const navItems = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/pages', label: 'Pages' },
  { href: '/dashboard/rules', label: 'Rules' },
  { href: '/dashboard/conversations', label: 'Conversations' },
  { href: '/dashboard/analytics', label: 'Analytics' },
  { href: '/dashboard/ai', label: 'AI fallback' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) router.replace('/login');
  }, [router]);

  function logout() {
    clearToken();
    router.push('/login');
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-5 py-4 font-semibold text-brand-600 border-b border-slate-200">
          fb-autoreply
        </div>
        <nav className="flex-1 px-3 py-3 space-y-1">
          {navItems.map((item) => {
            const active =
              item.href === '/dashboard' ? pathname === item.href : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-3 py-2 rounded-md text-sm ${
                  active
                    ? 'bg-brand-50 text-brand-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={logout}
          className="m-3 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-md py-2"
        >
          Logout
        </button>
      </aside>
      <main className="flex-1 px-8 py-6">{children}</main>
    </div>
  );
}
