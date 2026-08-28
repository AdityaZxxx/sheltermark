# Setup

Getting the Sheltermark web app + extension running locally.

## Prerequisites

- [Bun](https://bun.sh/) (package manager + runtime)
- [Docker](https://docs.docker.com/get-docker/) (runs the local Supabase stack; your user must be in the `docker` group)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (local stack + DB migrations)
- Node 20+ (for some tooling)

Day-to-day development runs entirely against the local Supabase stack — no
cloud project needed. Access to the production Supabase project is only
required for promoting migrations (`supabase db push`).

## Install

```bash
bun install
```

## Environment

**Local and production databases are fully separated.** `.env` always points
at the local Supabase stack and is used by both `bun run dev` and `bun test`.
Production credentials live **only** in Vercel env vars — never put them in
local env files.

Copy `.env.example` to `.env`. The Supabase vars take the local values printed
by `supabase start` (or `supabase status`):

| Variable                        | Required         | Description                                                                                                                                                            |
| ------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                  | yes              | Drizzle/service-role Postgres connection. Local: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`. Without it, live-DB test suites are skipped.               |
| `NEXT_PUBLIC_SITE_URL`          | yes              | Public URL of the deployment. `http://localhost:3000` in dev. Crawler-facing metadata only (metadataBase, og:image); auth redirects follow the request origin instead. |
| `NEXT_PUBLIC_SUPABASE_URL`      | yes              | Supabase URL (client-safe). Local: `http://127.0.0.1:54321`.                                                                                                           |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes              | Supabase anon key (client-safe). Local: from `supabase start` output.                                                                                                  |
| `SUPABASE_URL`                  | yes (server)     | Same Supabase URL, used by server actions + cron scripts.                                                                                                              |
| `SUPABASE_SERVICE_ROLE_KEY`     | yes (server)     | Supabase service role key. Bypasses RLS — keep secret, never expose to client.                                                                                         |
| `GOOGLE_CLIENT_ID`              | for Google OAuth | Google OAuth client ID. Not registered for the local stack — log in with seeded fixture users instead (see below).                                                     |
| `GOOGLE_CLIENT_SECRET`          | for Google OAuth | Google OAuth client secret.                                                                                                                                            |
| `OLLAMA_API_KEY`                | for AI features  | Ollama Cloud API key. See https://ollama.com/settings/keys                                                                                                             |
| `AI_MODEL`                      | for AI features  | Ollama model name, e.g. `minimax-m3:cloud`. No fallback — must be set for AI features to work.                                                                         |
| `NEXT_PUBLIC_LOG_LEVEL`         | no               | `debug \| info \| warn \| error` (default: `info`).                                                                                                                    |

Client-safe vars (`NEXT_PUBLIC_*`) are exposed to the browser. Server-only vars (`SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_SECRET`) must never be prefixed with `NEXT_PUBLIC_`.

## Local Database

The local stack is defined by `supabase/config.toml` and runs in Docker
(analytics is disabled — it's flaky locally and unused):

```bash
supabase start         # boot the stack (~10–30 s; first run pulls ~2 GB of images)
supabase stop          # shut it down
supabase db reset      # wipe local DB, re-apply all migrations + supabase/seed.sql
```

`supabase/seed.sql` creates the fixture users the live-DB test suites
(`tests/integration/*-isolation.test.ts`, `audit.test.ts`) require:

- **Agent user** `52a3cabd-90dd-4019-8267-b926ffd59a6e` — default + one extra
  workspace, one bookmark, one tag. Log in as
  `agent-fixture@example.com` / `password` (pre-confirmed; Google OAuth is not
  registered locally).
- **Foreign user** `8256b5a2-2c49-4e30-afd1-671c183fb7c9` — workspace,
  bookmark, tag, feed. Used as the "another user's data" fixture; never log in
  as this user from tests.

If a new table needs fixture rows for tests, extend `seed.sql` — it runs only
locally, never against production. Studio (local dashboard) is at
`http://127.0.0.1:54323`.

## Database Migrations

Migrations are generated by drizzle-kit from `lib/data/schema.ts` (the source
of truth) into `supabase/migrations/` and applied with the Supabase CLI.

### Dev loop (local first)

```bash
# 1. Edit lib/data/schema.ts, then generate the migration
bun run db:generate --name=<short_name>

# 2. Review the generated .sql. drizzle-kit cannot express RLS policies,
#    triggers, or plpgsql functions — splice those into the file by hand
#    before applying (see supabase/migrations/20260820055630_add_audit_events.sql).
#    For pure SQL helpers, place them before the statements that reference them.
#    New user-data tables need ENABLE ROW LEVEL SECURITY + ownership policies;
#    the app connects with the service role (RLS bypassed), so repositories
#    must also filter by user_id.

# 3. Apply locally and test
supabase migration up      # apply only new migrations, keep local data
supabase db reset          # alternatively: full re-apply + reseed
bun run test
```

### Promote to production

```bash
supabase db push --dry-run   # preview against the linked production project
supabase db push             # apply unapplied migrations to production
```

Push the migration **before** deploying the code that uses it (promote `dev` →
`prod` after the push) — migrations are additive, so this order never breaks
the running app. `supabase db push` is the only way migrations reach the
remote database; production deploys (Vercel) never run migrations.

The `supabase/migrations/meta/` journal is drizzle-kit's record of what has
been generated; commit it alongside the `.sql` files. Never hand-edit `schema.ts`
to make it match the database — edit `schema.ts` and regenerate instead.

`drizzle-kit migrate` is intentionally NOT used — it would create a second
tracker table (`__drizzle_migrations`) alongside `supabase_migrations`.

## Run the Web App

```bash
bun run dev          # http://localhost:3000
```

## Run the Extension

The extension is TypeScript source under `extension/` and needs to be built to `extension/dist/` before Chrome can load it.

```bash
bun run ext:build    # one-shot build
bun run ext:watch    # rebuild on save
```

Load into Chrome:

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `extension/` folder (the one containing `manifest.json`)
5. After rebuilding, click the reload icon on the extension card

The extension talks to the web app over `https://sheltermark.vercel.app/*` in production (see `extension/manifest.json` `host_permissions`). For local dev against `localhost:3000`, set the base URL via the extension's options page (`chrome://extensions` → Sheltermark → Details → Extension options). The value is stored in `chrome.storage.sync` under key `baseUrl` (see `extension/storage.ts`).

See also: [`docs/architecture.md`](./architecture.md) for the extension↔web auth bridge.
