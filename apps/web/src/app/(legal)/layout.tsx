import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Legal — fb-autoreply',
  robots: { index: true, follow: true },
};

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-semibold text-brand-700">
            fb-autoreply
          </Link>
          <nav className="text-sm text-slate-600 flex gap-4">
            <Link href="/privacy" className="hover:text-slate-900">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-slate-900">
              Terms
            </Link>
            <Link href="/data-deletion" className="hover:text-slate-900">
              Data deletion
            </Link>
          </nav>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-10">
        <article className="legal-article">{children}</article>
      </main>
      <footer className="border-t border-slate-200 mt-12">
        <div className="max-w-3xl mx-auto px-6 py-6 text-xs text-slate-500">
          fb-autoreply &middot; Auto-reply SaaS for Facebook pages.
        </div>
      </footer>
    </div>
  );
}
