# fb-autoreply

A multi-tenant SaaS that auto-replies to **Facebook page comments** and
**Messenger DMs** using a rules engine plus an optional **OpenAI fallback**.

Built on the **official Meta Graph API** — no scraping, no Selenium, no
risk of getting your page banned. The same approach used by ManyChat,
Chatfuel, and other commercial products.

> **Status: MVP scaffold (Phase 1).** Wire up your Meta App, run the stack,
> and start replying. Phase 2 will add Stripe billing, team roles, and
> deeper analytics — see the roadmap below.

---

## Architecture

```
Facebook Page  ──▶  Webhook ──▶  Express API  ──▶  Rules Engine ──▶  Graph API ──▶  Reply
                                       │                  │
                                       ▼                  ▼
                                  PostgreSQL         OpenAI (fallback)
```

| App / Package          | Purpose                                                  |
| ---------------------- | -------------------------------------------------------- |
| `apps/api`             | Express + TypeScript + Prisma. Webhooks, REST, business logic. |
| `apps/web`             | Next.js 14 + Tailwind. Dashboard for tenants.            |
| `packages/shared`      | Shared Zod schemas and TypeScript types.                 |

The DB schema is **multi-tenant from day one** (every domain row carries a `tenantId`),
so adding billing & team features in Phase 2 won't require a refactor.

---

## Quickstart (local development)

### 1. Prerequisites

- Node.js 20+
- npm 10+
- Docker (for Postgres) — or a Postgres 14+ instance you already have
- (Optional) An OpenAI API key for AI fallback
- A public HTTPS URL for the webhook (use [`ngrok`](https://ngrok.com/) or a deployed instance)

### 2. Install

```bash
git clone https://github.com/ahmedallam222/fb-autoreply
cd fb-autoreply
npm install
```

### 3. Configure environment

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Edit `apps/api/.env` and set at minimum:

| Variable            | What                                                  |
| ------------------- | ----------------------------------------------------- |
| `DATABASE_URL`      | Postgres connection string                            |
| `JWT_SECRET`        | Any random string ≥ 16 chars                          |
| `FB_VERIFY_TOKEN`   | Any random string — you'll paste the same one in the Meta dashboard |
| `FB_APP_ID`         | From your Meta App                                    |
| `FB_APP_SECRET`     | From your Meta App                                    |
| `OPENAI_API_KEY`    | (Optional) for AI fallback                            |

### 4. Boot Postgres + migrate

```bash
docker compose up -d postgres
npm run db:push          # creates tables from prisma/schema.prisma
npm run db:seed --workspace=apps/api  # creates demo@example.com / demo1234 with sample rules
```

### 5. Run

```bash
npm run dev    # starts api on :4000 and web on :3000
```

Visit <http://localhost:3000>, login with `demo@example.com` / `demo1234`, or sign up fresh.

### 6. Expose the webhook to Meta

The Meta webhook server has to reach your machine over HTTPS. In another terminal:

```bash
ngrok http 4000
```

Take the resulting URL (e.g. `https://abcd-1234.ngrok-free.app`) and use:

- **Callback URL**: `https://<ngrok>/api/webhooks/facebook`
- **Verify Token**: same value as `FB_VERIFY_TOKEN` in your `.env`

---

## Setting up your Meta App

1. Go to <https://developers.facebook.com/apps> and create a new app of type **Business**.
2. Add the **Webhooks** product. Subscribe to the **Page** object with fields:
   `feed`, `messages`, `messaging_postbacks`.
3. Add the **Facebook Login for Business** product (optional — only needed for the OAuth flow).
4. Copy your **App ID** and **App Secret** into `apps/api/.env`.
5. Required permissions (request via App Review for production):
   - `pages_show_list`
   - `pages_messaging`
   - `pages_manage_engagement`
   - `pages_read_engagement`
   - `pages_manage_metadata`

While in **Development Mode**, only admins/testers of the App can use the integration.
That is plenty for testing — you don't need App Review until you go live for real customers.

### Manual page connect (no App Review required)

For local dev you can skip OAuth entirely:

1. Open the [Graph API Explorer](https://developers.facebook.com/tools/explorer/).
2. Select your app → request a Page Access Token with the permissions above.
3. In the dashboard go to **Pages → Manual connect** and paste:
   - **Page ID**
   - **Page name**
   - **Page Access Token**

The API will subscribe the page to webhooks for you.

---

## How it processes events

1. **Webhook hit** — Meta POSTs to `/api/webhooks/facebook` with an `X-Hub-Signature-256` header.
2. **Signature verified** with `FB_APP_SECRET` (constant-time HMAC compare).
3. **200 returned immediately** so Meta doesn't retry; events are processed asynchronously.
4. **Self-events filtered** — comments/messages authored by the page itself are skipped to avoid loops.
5. **Conversation upserted** keyed on `(pageId, externalId)`.
6. **Rules engine** finds the highest-priority matching rule.
7. **AI fallback** (if enabled and no rule matched) generates a reply via OpenAI.
8. **Reply posted** via Graph API:
   - Comments → `POST /{comment_id}/comments`
   - Messages → `POST /me/messages` with `messaging_type=RESPONSE`
9. **All reply events logged** (inbound + outbound + errors) for the dashboard.

---

## API surface

| Method | Path                                  | Auth | Description                             |
| ------ | ------------------------------------- | ---- | --------------------------------------- |
| GET    | `/health`                             | —    | Health check                            |
| POST   | `/api/auth/signup`                    | —    | Create tenant + first user              |
| POST   | `/api/auth/login`                     | —    | Get JWT                                 |
| GET    | `/api/auth/me`                        | yes  | Current user + tenant                   |
| GET    | `/api/pages`                          | yes  | List connected pages                    |
| POST   | `/api/pages/manual`                   | yes  | Manual page connect                     |
| GET    | `/api/pages/oauth/url`                | yes  | Begin OAuth                             |
| GET    | `/api/pages/oauth/callback`           | yes  | OAuth callback (redirect target)        |
| DELETE | `/api/pages/:id`                      | yes  | Disconnect a page                       |
| GET/POST/PUT/DELETE | `/api/rules[/:id]`       | yes  | CRUD rules                              |
| GET/PUT | `/api/ai`                            | yes  | Read/update AI config                   |
| GET    | `/api/conversations`                  | yes  | List recent conversations               |
| GET    | `/api/conversations/:id`              | yes  | Conversation detail w/ events           |
| GET/POST | `/api/webhooks/facebook`            | sig  | Meta webhook (verification + delivery)  |

---

## Deployment notes

- **Hosting**: Railway / Render / Fly.io are all great. The API needs HTTPS and a public URL.
- **Database**: managed Postgres (Neon, Supabase, Railway).
- **Set secrets** for `DATABASE_URL`, `JWT_SECRET`, `FB_APP_ID`, `FB_APP_SECRET`, `FB_VERIFY_TOKEN`, optionally `OPENAI_API_KEY`.
- Run `npx prisma migrate deploy` (after switching from `db push` to migrations) on each deploy.

---

## Phase 2 roadmap

- [ ] Stripe / Paymob billing (subscription tiers, usage metering)
- [ ] Team members + RBAC (OWNER / ADMIN / MEMBER)
- [ ] Encrypted-at-rest page access tokens
- [ ] Rate limiting + queueing (BullMQ + Redis)
- [ ] Working hours / out-of-office
- [ ] Per-rule analytics + conversation transcripts UI
- [ ] App Review submission docs + screencast
- [ ] Multi-language detection
- [ ] Auto-DM ("we just sent you a private message")
- [ ] Privacy Policy + Terms (required for App Review)

---

## Security TODOs (before production)

- Encrypt `FacebookPage.pageAccessToken` (e.g. AES-GCM with `KMS_KEY`).
- Rotate JWT signing key + add refresh tokens.
- Replace in-memory token storage on the web with secure cookies.
- Add rate limits to `/api/auth/*` endpoints.
- Add a `state` parameter to the OAuth callback tied to the user's session.

---

## Scripts

```bash
npm run dev              # api + web in parallel
npm run build            # all workspaces
npm run lint             # all workspaces
npm run typecheck        # all workspaces
npm test --workspace=apps/api  # rules-engine unit tests
npm run db:push          # apply schema to dev DB
npm run db:migrate       # create + apply migration
npm run db:studio        # Prisma Studio
```

---

## License

MIT.
