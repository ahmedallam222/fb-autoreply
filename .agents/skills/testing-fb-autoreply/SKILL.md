---
name: testing-fb-autoreply
description: End-to-end test the fb-autoreply MVP locally — dashboard UI flows + webhook pipeline. Use when verifying rules engine, multi-tenant isolation, AI config persistence, or any change touching apps/api/src/routes/webhook.ts or apps/api/src/services/auto-reply.ts.
---

# Testing fb-autoreply locally

## Start everything
```bash
docker compose up -d postgres
npm install
npm run db:push --workspace=apps/api
npm run db:seed --workspace=apps/api
npm run dev          # boots API:4000 + web:3000 in parallel
```
If `npm run dev:api` fails with `EBADF` under nohup, run it as `nohup npx tsx src/index.ts < /dev/null > /tmp/api.log 2>&1 &` from `apps/api/`.

## Demo credentials (seeded)
- Email: `demo@example.com`
- Password: `demo1234`
- Tenant id: `demo-tenant`
- Seeded rules: `demo-rule-pricing` (priority 10, keywords `price/pricing/cost/سعر/بكام`) + `demo-rule-greeting` (priority 5)

The seed creates **no** `FacebookPage` row — webhook tests need to insert one manually.

## Dashboard test pass (UI, recorded)

1. **Tenant isolation** — sign up a brand new workspace at `/signup`. Dashboard should show `0 connected pages / 0 active rules / 0 total rules`. If it shows the demo's seeded rules, the tenant filter on `/api/rules` is broken.
2. **Demo login** — log in as demo. Rules page should show `Pricing question` (priority 10, green Enabled) above `Greeting` (priority 5).
3. **Rule CRUD** — `New rule` → fill name/keywords/template/priority. After saving and F5, the new rule sits at the correct priority position. Toggle Enabled off → badge flips to red `Disabled`. Click `Delete` → row disappears with no Next.js error overlay.
4. **AI config** — `/dashboard/ai`, toggle Enable, change Temperature, Save, F5 → values stick.

### Watch out for the native `confirm()` dialog
The Delete button uses `window.confirm`. Auto-clickers can't accept the native dialog. Override it before clicking:
```js
// in browser devtools console (or via computer console action)
window.confirm = () => true;
```

## Webhook test pass (shell, signed payload)

The webhook is the core feature; test it end-to-end without a real Meta app.

### Setup
1. Set a non-empty secret in `apps/api/.env`:
   ```
   FB_APP_SECRET=local-dev-secret-for-testing
   ```
   Restart the API after editing.
2. Insert a synthetic page tied to `demo-tenant`:
   ```js
   await prisma.facebookPage.upsert({
     where: { fbPageId: '999000111222333' },
     update: {},
     create: {
       fbPageId: '999000111222333',
       tenantId: 'demo-tenant',
       pageAccessToken: 'fake-token-for-testing',
       name: 'Test Page',
     },
   });
   ```

### Three signed-payload assertions
- **Bad signature** → POST a comment payload with `x-hub-signature-256: sha256=garbage`. Expect HTTP **403** and zero new ReplyEvent rows.
- **Valid signature, matching message** → POST a comment payload with `value.message = 'what is the price for this?'`, `from = { id: '111111', name: 'Jane Doe' }`. Sign with HMAC-SHA256 over the raw body. Expect HTTP **200**, a new `Conversation`, an INBOUND ReplyEvent and an OUTBOUND ReplyEvent with `source = 'RULE'`, `matchedRuleId = 'demo-rule-pricing'`, and `outboundText` starting with `Hi Jane!`. The OUTBOUND row will also have `errorMessage` populated (Graph API rejects the fake token) — that's expected and proves the pipeline reached the call site with the right payload.
- **Self-event filter** → POST a payload where `value.from.id === fbPageId`. Expect 200 but **no new ReplyEvent rows** (the page replying to itself would cause infinite loops).

### Cleanup (always do this)
1. Revert `FB_APP_SECRET` in `apps/api/.env` back to empty.
2. Delete the synthetic page + its events:
   ```js
   const page = await prisma.facebookPage.findUnique({ where: { fbPageId: '999000111222333' } });
   if (page) {
     await prisma.replyEvent.deleteMany({ where: { conversation: { pageId: page.id } } });
     await prisma.conversation.deleteMany({ where: { pageId: page.id } });
     await prisma.facebookPage.delete({ where: { id: page.id } });
   }
   ```

## Common gotchas
- **DELETE 204 + api client** — `apps/web/src/lib/api.ts` must bail before `res.json()` on 204 / `content-length: 0`, otherwise every delete crashes. If you see `SyntaxError: Failed to execute 'json' on 'Response': Unexpected end of JSON input`, this regressed.
- **ESM in `packages/shared`** — `packages/shared/package.json` must keep `"type": "module"`. Without it the API crashes on boot with `does not provide an export named ...`.
- **`pino-pretty`** — must stay listed in `apps/api/dependencies` (not just transitive). Without it the dev logger throws `unable to determine transport target for "pino-pretty"`.
- **Arabic keywords in inputs** — comma-separated keyword inputs sometimes drop characters when typed via automation; verify what the API stored, not what the input field shows.

## What can NOT be tested locally without user-provided secrets
- Live Facebook OAuth (needs `FB_APP_ID` + `FB_APP_SECRET` from a real Meta App)
- Real Graph API send (needs a real Page Access Token)
- Real Meta webhook delivery (needs ngrok + Meta webhook subscription)
- AI fallback against OpenAI (needs `OPENAI_API_KEY`)

Design the test pass around these constraints — assert on the DB-level effects of the pipeline, not on the network calls themselves. The fake-token error logged on the OUTBOUND ReplyEvent is *evidence* that the pipeline reached the Graph API call with the correct payload.

## Devin Secrets Needed
- None for local testing. Real production testing would need: `FB_APP_ID`, `FB_APP_SECRET`, `FB_VERIFY_TOKEN`, a long-lived Page Access Token, optionally `OPENAI_API_KEY`.
