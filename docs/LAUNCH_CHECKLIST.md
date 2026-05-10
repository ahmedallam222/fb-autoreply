# Production Launch Checklist

Run through this list **in order** before pointing real customers at the
app. Each item below is something the MVP can technically run without,
but production cannot.

## 0. The two non-negotiables

- [ ] **Generate `TOKEN_ENCRYPTION_KEY`** with `openssl rand -hex 32` and
      set it as a 32-byte hex env var on the API. The server refuses to
      boot in `NODE_ENV=production` without it. Without this set, Page
      Access Tokens are stored in plaintext.
- [ ] **Set `JWT_SECRET`** to a value at least 32 characters long that you
      generated yourself (do **not** ship the dev default).

## 1. Domains & TLS

- [ ] Pick a public domain for the API (e.g. `api.example.com`) and the
      web app (e.g. `app.example.com`). HTTPS-only. Let's Encrypt is fine.
- [ ] Set `PUBLIC_API_URL` and `PUBLIC_WEB_URL` env vars on the API.
      These are used in invite emails, OAuth redirects, and logging.
- [ ] Set `NEXT_PUBLIC_API_URL` env var on the web app at build time.

## 2. Database

- [ ] Use a managed Postgres (Railway, Supabase, RDS, Neon, etc.) — not
      the local Docker compose service.
- [ ] Run `npm run db:push --workspace=apps/api` against the production
      DB **once** to create the schema. For all later schema changes, use
      `prisma migrate deploy` so production has versioned migrations.
- [ ] Enable automated backups on the DB provider (daily snapshot at
      minimum).
- [ ] Confirm the `pgcrypto` extension is enabled if your provider
      requires it (most do by default).

## 3. Meta App configuration

- [ ] Create the Meta App in
      [https://developers.facebook.com/apps/](https://developers.facebook.com/apps/).
- [ ] Add products: **Facebook Login**, **Messenger**, **Webhooks**.
- [ ] Settings → Basic: copy `App ID` and `App Secret` into the API env
      as `FB_APP_ID` and `FB_APP_SECRET`.
- [ ] In Webhooks, subscribe to `feed` and `messages` on the Page object.
      Set the callback URL to `https://<api-domain>/api/webhooks/facebook`
      and the verify token to a random string you set as
      `FB_VERIFY_TOKEN` in the API env.
- [ ] App Review: see [`META_APP_REVIEW.md`](./META_APP_REVIEW.md) and
      [`META_APP_REVIEW_SCREENCAST.md`](./META_APP_REVIEW_SCREENCAST.md).

## 4. Email (optional but strongly recommended)

Without SMTP, invite emails and notification emails are silently skipped,
and users only see the accept-link inline in the dashboard.

- [ ] Pick an SMTP provider (Postmark, SendGrid, AWS SES, Resend). Most
      have free tiers up to ~100 emails/day.
- [ ] Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
      env vars on the API.
- [ ] Verify with the **Send test email** button on `/dashboard/notifications`.

## 5. AI (optional)

- [ ] Set `OPENAI_API_KEY` if you want the AI fallback. Without it,
      messages that don't match a rule simply aren't replied to.
- [ ] Recommended starting model: `gpt-4o-mini` (cheap, fast). Configure
      per-tenant from the dashboard's AI page.

## 6. Operational hygiene

- [ ] Pick a host. Railway, Render, Fly, or your own VPS all work. Keep
      `apps/api` (server) and `apps/web` (Next.js) as **separate**
      deployments — the rate limiter and the Pino logger expect a
      single-instance server, and the web app prerenders many of its
      routes.
- [ ] **Single-instance only.** The notification scheduler and the
      per-tenant rate limiter both keep state in-process. Running 2+
      replicas of the API means you'll send daily-digest emails twice.
      Scaling out is on the Phase 2 roadmap (move scheduler + rate
      limiter to Redis).
- [ ] Wire your host's logs to a log drain (Better Stack, Datadog, etc.)
      and grep for `error_alert_sent`, `webhook_signature_mismatch`,
      `oauth_callback_failed`.
- [ ] Set up uptime monitoring on `/health` and on
      `/api/webhooks/facebook` (Meta will mark your app unhealthy and
      can throttle / unsubscribe webhooks if either is down).

## 7. Legal

- [ ] In `apps/web/src/app/(legal)/{privacy,terms,data-deletion}/page.tsx`,
      replace the `COMPANY`, `CONTACT_EMAIL`, and `LAST_UPDATED`
      placeholders with your real values. (`rg COMPANY apps/web/src/app/\(legal\)`.)
- [ ] Confirm all three pages return HTTP 200 from your public web
      domain.

## 8. First customer

- [ ] Reset the seed data — production should not have demo rules. Run
      `DATABASE_URL=<prod-url> npx prisma migrate reset --force --skip-seed`
      against the prod DB **before** any real signups (this will wipe
      data — don't run after launch). Or simply skip running the seed
      against prod in the first place.
- [ ] Sign yourself up first as the "internal owner" to verify the full
      flow on production hardware.
- [ ] Connect *your own* Page first, write a real rule, post a real
      comment, watch the reply land. Only then invite paying customers.
