# Setup

Getting the Sheltermark web app + extension running locally.

## Prerequisites

- [Bun](https://bun.sh/) (package manager + runtime)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (only for DB migrations)
- Node 20+ (for some tooling)
- A Supabase project — create one at [supabase.com](https://supabase.com) or self-host

## Install

```bash
bun install
```

## Environment

Copy `.env.example` to `.env` and fill in:

| Variable                        | Required                 | Description                                                                    |
| ------------------------------- | ------------------------ | ------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SITE_URL`          | yes                      | Public URL of the deployment. `http://localhost:3000` in dev.                  |
| `NEXT_PUBLIC_SUPABASE_URL`      | yes                      | Supabase project URL (client-safe).                                            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes                      | Supabase anon key (client-safe).                                               |
| `SUPABASE_URL`                  | yes (server)             | Same Supabase URL, used by server actions + cron scripts.                      |
| `SUPABASE_SERVICE_ROLE_KEY`     | yes (server)             | Supabase service role key. Bypasses RLS — keep secret, never expose to client. |
| `GOOGLE_CLIENT_ID`              | for Google OAuth         | Google OAuth client ID.                                                        |
| `GOOGLE_CLIENT_SECRET`          | for Google OAuth         | Google OAuth client secret.                                                    |
| `OLLAMA_API_KEY`                | for AI title suggestions | Ollama Cloud API key. See https://ollama.com/settings/keys                     |
| `NEXT_PUBLIC_LOG_LEVEL`         | no                       | `debug \| info \| warn \| error` (default: `info`).                            |

Client-safe vars (`NEXT_PUBLIC_*`) are exposed to the browser. Server-only vars (`SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_SECRET`) must never be prefixed with `NEXT_PUBLIC_`.

## Database Migrations

Migrations live in `supabase/migrations/` as timestamped `.sql` files. Apply them with the Supabase CLI:

```bash
supabase db push                        # apply pending migrations to linked project
# or, to apply a specific migration against the linked DB:
supabase migration up
```

For a fresh local Supabase, run `supabase start` first (starts the local Docker stack), then `supabase db reset` to apply all migrations from scratch.

The most recent migration (`20260720000000_remove_manual_override.sql`) removes the `manual_override` state and `manually_marked_alive_at` column from broken-link detection. See [`docs/adr/0002-remove-manual-override.md`](./adr/0002-remove-manual-override.md).

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
