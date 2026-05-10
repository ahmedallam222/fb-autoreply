import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between border-b bg-white">
        <div className="font-semibold text-lg text-brand-600">fb-autoreply</div>
        <nav className="flex gap-3 text-sm">
          <Link href="/login" className="text-slate-600 hover:text-slate-900">
            Login
          </Link>
          <Link
            href="/signup"
            className="bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-md"
          >
            Sign up
          </Link>
        </nav>
      </header>

      <section className="flex-1 px-6 py-16 max-w-5xl mx-auto w-full">
        <h1 className="text-4xl font-bold tracking-tight">
          Auto-reply to Facebook comments &amp; Messenger DMs.
        </h1>
        <p className="mt-4 text-slate-600 text-lg max-w-2xl">
          Connect your Facebook page, define keyword rules, and let AI handle the rest. Built on
          the official Meta Graph API — no risky scraping.
        </p>

        <div className="mt-8 flex gap-3">
          <Link
            href="/signup"
            className="bg-brand-500 hover:bg-brand-600 text-white px-5 py-2.5 rounded-md font-medium"
          >
            Get started — free
          </Link>
          <a
            href="https://developers.facebook.com/docs/messenger-platform"
            target="_blank"
            rel="noreferrer"
            className="border border-slate-300 hover:bg-slate-100 px-5 py-2.5 rounded-md font-medium"
          >
            Docs
          </a>
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-6">
          <Feature
            title="Keyword rules"
            body="Match by exact, contains, starts-with, or regex. Per-rule cooldowns and priorities."
          />
          <Feature
            title="AI fallback"
            body="When no rule matches, GPT-4o-mini answers in the customer's language, on-brand."
          />
          <Feature
            title="Multi-tenant by design"
            body="Built for SaaS from day one. Add Stripe, team roles, and analytics in Phase 2."
          />
        </div>
      </section>
    </main>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg bg-white border border-slate-200 p-5">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{body}</p>
    </div>
  );
}
