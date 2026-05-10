# Deploying fb-autoreply to Railway

This guide gets you from a fresh Railway account to a live, public
deployment in ~10 minutes. The repo ships two services (`apps/api` and
`apps/web`) and uses PostgreSQL.

## Prerequisites

- A [Railway account](https://railway.app) (free tier includes $5/mo credit)
- This repo on GitHub: <https://github.com/ahmedallam222/fb-autoreply>
- A [Meta App](https://developers.facebook.com/apps/) (Business type) — see
  [Meta App Review pack](docs/META_APP_REVIEW.md)
- (Optional) An [OpenAI API key](https://platform.openai.com/api-keys) for AI fallback
- (Optional) A [Stripe account](https://dashboard.stripe.com/register) for billing

## Step 1: Create the Railway project

1. Go to <https://railway.app/new> → "Deploy from GitHub repo"
2. Pick `ahmedallam222/fb-autoreply`. Railway will create the project.
3. **Don't** let it auto-deploy yet — close any service it spins up. We'll
   create the right ones manually.

## Step 2: Add PostgreSQL

1. Inside the project, click **+ New** → **Database** → **Add PostgreSQL**.
2. Railway auto-creates `DATABASE_URL` and exposes it as a reference
   variable to the project.

## Step 3: Create the API service

1. Click **+ New** → **GitHub Repo** → pick the same repo.
2. Settings tab on the new service:
   - **Service name**: `api`
   - **Root Directory**: `/` (leave at repo root — this is a monorepo)
   - **Config-as-Code**: Railway auto-detects `apps/api/railway.json`. If
     it doesn't, set:
     - **Custom Build Command**:
       `npm ci --workspaces --include-workspace-root && npm run db:generate --workspace=apps/api && npm run build --workspace=apps/api`
     - **Custom Start Command**:
       `npm run start:prod --workspace=apps/api`
     - **Healthcheck Path**: `/health`
   - **Watch Paths** (optional, to skip web-only redeploys): `apps/api/**`, `packages/shared/**`, `package*.json`
3. Variables tab → add the environment variables:

   ```
   NODE_ENV=production
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   JWT_SECRET=<run: openssl rand -hex 32>
   TOKEN_ENCRYPTION_KEY=<run: openssl rand -hex 32>
   FB_APP_ID=<from Meta App settings>
   FB_APP_SECRET=<from Meta App settings>
   FB_VERIFY_TOKEN=<any random string you choose>
   FB_API_VERSION=v21.0
   PUBLIC_API_URL=${{RAILWAY_PUBLIC_DOMAIN}}
   PUBLIC_WEB_URL=<paste the web service's domain after Step 4>
   FB_OAUTH_REDIRECT_URI=${{RAILWAY_PUBLIC_DOMAIN}}/api/auth/facebook/callback
   ```

   Optional but recommended:

   ```
   OPENAI_API_KEY=<from OpenAI dashboard>
   STRIPE_SECRET_KEY=<sk_live_… or sk_test_…>
   STRIPE_WEBHOOK_SECRET=<whsec_…, see Step 6>
   STRIPE_PRICE_ID_PRO=<price_…>
   STRIPE_PRICE_ID_BUSINESS=<price_…>
   SMTP_HOST=smtp.postmarkapp.com   # or sendgrid, ses, etc
   SMTP_PORT=587
   SMTP_USER=<smtp username>
   SMTP_PASS=<smtp password>
   SMTP_FROM=fb-autoreply <noreply@yourdomain.com>
   ```

4. Settings → **Networking** → **Generate Domain**. Note the URL — looks
   like `api-production-xxxx.up.railway.app`.

## Step 4: Create the web service

1. Click **+ New** → **GitHub Repo** → same repo again.
2. Settings tab:
   - **Service name**: `web`
   - **Root Directory**: `/`
   - **Config-as-Code**: Railway auto-detects `apps/web/railway.json`.
     If not, set the equivalents from that file manually.
3. Variables tab:

   ```
   NODE_ENV=production
   NEXT_PUBLIC_API_URL=https://<api-domain-from-step-3>
   ```

   `NEXT_PUBLIC_API_URL` MUST point at the api service's public URL with
   the `https://` scheme — Next.js bakes this into the client bundle at
   build time.

4. Settings → Networking → **Generate Domain**. Note the URL — looks like
   `web-production-yyyy.up.railway.app`.

5. Go back to the **api** service and update `PUBLIC_WEB_URL` to the web
   domain from this step. Save → it will redeploy.

## Step 5: Run the first migration

The api service runs `prisma db push --skip-generate` on every boot via
`start:prod`, so the schema syncs automatically the first time the api
container starts. Watch the deploy logs in Railway — you should see:

```
🚀  Your database is now in sync with your Prisma schema.
api_listening port=… env=production
```

Verify:

```
curl https://<api-domain>/health
# → {"ok":true,"service":"fb-autoreply-api","ts":"…"}
```

## Step 6: Configure Meta webhook

1. <https://developers.facebook.com/apps/> → your app → **Webhooks**
2. **Page** → Subscribe to:
   - `messages`
   - `messaging_postbacks`
   - `feed` (for comments)
3. **Callback URL**: `https://<api-domain>/api/webhooks/facebook`
4. **Verify Token**: same value you set as `FB_VERIFY_TOKEN`
5. Click **Verify and Save**. Meta will GET `/api/webhooks/facebook?hub.mode=subscribe&...`
   and our handler responds with the challenge.

## Step 7: (Optional) Configure Stripe webhook

1. <https://dashboard.stripe.com/webhooks> → **Add endpoint**
2. URL: `https://<api-domain>/api/webhooks/stripe`
3. Events: `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`
4. Copy the signing secret → set as `STRIPE_WEBHOOK_SECRET` on the api
   service → redeploy.

## Step 8: Connect your first Page

1. Visit `https://<web-domain>` → Sign up.
2. Onboarding wizard → **Connect Page**. For now use **Manual connect**
   with a Page Access Token from
   [Graph API Explorer](https://developers.facebook.com/tools/explorer/).
3. Add a rule (or skip — there's a "Pricing" preset).
4. Optional: enable **AI fallback** under `/dashboard/ai`.
5. Comment on one of your Page's posts to verify the auto-reply fires.
   The conversation transcript at `/dashboard/conversations/<id>` should
   show the inbound + outbound + (if enabled) private DM events.

## Troubleshooting

### "TOKEN_ENCRYPTION_KEY must be set in production"

The api refuses to boot in `NODE_ENV=production` without a 32-byte hex
key. Generate one and set it on the api service:

```
openssl rand -hex 32
```

### "Webhook verification failed"

Double-check the `FB_VERIFY_TOKEN` on the api service matches the value
you typed into Meta's Webhooks form. Both must be **identical**.

### "DATABASE_URL ECONNREFUSED" in deploy logs

The Postgres plugin sometimes takes ~30s to provision the first time.
Re-deploy the api service after Postgres shows green.

### Web app sees `localhost:4000` in production

The web bundle is built with `NEXT_PUBLIC_API_URL` baked in at **build
time**. Changing that variable requires a new deploy — click "Deploy"
on the web service after updating it.

## What about real migrations?

For now the api runs `prisma db push` on boot. This is fine for the MVP
where the schema is the source of truth and we can tolerate brief
locking on startup. Before you have many paying customers, switch to
migrations:

```
cd apps/api
npx prisma migrate dev --name init   # creates prisma/migrations/…
git commit -am "feat: initial migration"
```

Then update the api `start:prod` script to use
`prisma migrate deploy && node dist/index.js` instead.

## Costs

Rough monthly estimate at low traffic:

- Railway api service (hobby plan): $5
- Railway web service: $5
- Railway Postgres: $5
- Total Railway: ~$15
- OpenAI usage (gpt-4o-mini, 100 replies/day): ~$1
- **Total: ~$16/mo** for the first ~5 paying customers.

You can also deploy the web app to **Vercel** for free instead — point
`NEXT_PUBLIC_API_URL` at the Railway api domain and skip Step 4.
