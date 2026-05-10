# AGENTS.md

Repo: `fb-autoreply` — multi-tenant SaaS for Facebook auto-reply.

## Layout

```
apps/
  api/            Express + TypeScript + Prisma  (Node 20+)
  web/            Next.js 14 + Tailwind          (App Router)
packages/
  shared/         Zod schemas + TS types shared between api & web
```

## Local commands

| Task                     | Command                                  |
| ------------------------ | ---------------------------------------- |
| Install                  | `npm install`                            |
| Lint                     | `npm run lint`                           |
| Typecheck                | `npm run typecheck`                      |
| Test (rules engine)      | `npm test --workspace=apps/api`          |
| Generate Prisma client   | `npm run db:generate`                    |
| Apply schema to dev DB   | `npm run db:push`                        |
| Seed demo data           | `npm run db:seed --workspace=apps/api`   |
| Run api + web in parallel| `npm run dev`                            |

## Conventions

- **Multi-tenant**: every domain row carries `tenantId`. Every authenticated
  query MUST scope by `req.auth!.tid`.
- **Prisma client**: imported from `apps/api/src/lib/prisma.ts` (singleton).
- **Auth**: JWTs via `apps/api/src/lib/auth.ts`. Use `requireAuth` middleware.
- **Validation**: Zod schemas in `packages/shared/src/schemas.ts` are the source
  of truth for request/response shapes. Reuse from both api and web.
- **Webhook security**: all POSTs to `/api/webhooks/facebook` go through
  `verifyWebhookSignature` (HMAC-SHA256 with `FB_APP_SECRET`).

## Required env vars (api)

`DATABASE_URL`, `JWT_SECRET`, `FB_VERIFY_TOKEN` are mandatory.
`FB_APP_ID`, `FB_APP_SECRET`, `OPENAI_API_KEY` are required to use the OAuth
and AI features respectively but the server boots without them.

See `apps/api/.env.example`.

## Adding a new feature

1. Add the Zod schema to `packages/shared/src/schemas.ts` if it crosses the
   network boundary.
2. Add Prisma model(s) to `apps/api/prisma/schema.prisma` and run
   `npm run db:push`.
3. Add the Express route under `apps/api/src/routes/`. Mount it in
   `apps/api/src/index.ts`.
4. Add the dashboard page under `apps/web/src/app/dashboard/<feature>/page.tsx`.
5. Add unit tests for any logic in `apps/api/src/lib/`.
