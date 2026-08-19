# Architecture

The shape of the codebase. Read this once before changing anything non-trivial.

## Three Surfaces

Sheltermark has three deployable surfaces sharing one Supabase backend:

1. **Web app** — Next.js 16 App Router. The authenticated UI, public profile pages, trash, import/export. Deployed to Vercel.
2. **Chrome extension** — Manifest V3, TypeScript, built by esbuild to `extension/dist/`. Reads/writes bookmarks via the web app's API routes.
3. **Cron scripts** — three background jobs run via GitHub Actions. They hit Supabase directly with the service role key, bypassing the web app entirely.

## Request Flow

```
Browser (web app)
  └── React component
        └── TanStack Query mutation (lib/mutations/*.ts)
              └── Server action (app/action/*.ts)
                    ├── requireAuth() — lib/auth.ts (Supabase SSR client, session from cookie)
                    └── Repository (lib/data/repositories/*.ts)
                          └── Supabase (Postgres + RLS)

Browser extension
  └── background.ts / popup.ts
        └── fetch /api/extension/{auth,bookmark,check,workspaces}
              └── (same server action → repository → Supabase path as web app)

GitHub Actions cron
  └── scripts/{check-urls,sync-feeds,cleanup-trash}.ts
        └── Supabase directly (service role key, bypasses RLS)
```

## Mutation Pattern

Every write goes through three layers. Bypassing any of them breaks invariants.

1. **Server Action** (`app/action/<entity>.action.ts`) — gates with `requireAuth()` from `lib/auth.ts`, passes the user + Drizzle db to the repository.
2. **Repository** (`lib/data/repositories/<entity>.repository.ts`) — validates input with a Zod schema from `lib/schemas/`, executes the database query, returns typed results.
3. **Client Hook** (`hooks/use-*.ts` or `lib/mutations/<entity>.mutations.ts`) — wraps the server action in TanStack Query's `useMutation`, with optimistic updates against the matching `lib/queries/<entity>.queries.ts` cache.

Reads go through TanStack Query hooks in `lib/queries/`. Query keys are centralized in `lib/query-keys.ts`.

### Data layer

All repositories use Drizzle ORM (the Supabase client is gone from the repository layer; it remains only in non-repository scripts like `scripts/check-urls.ts` and `scripts/cleanup-trash.ts`):

- **Drizzle schema:** `lib/data/schema.ts` — a derived model of the public schema, hand-written and kept in sync with `supabase/migrations/` (the canonical migration history; drizzle-kit migrations are not used, and drizzle-kit `generate` offline is the parity check).
- **Connection:** `lib/data/drizzle.ts` — server-only, pooled `DATABASE_URL` with `prepare: false`. Non-Next entrypoints (cron scripts) build instances via `lib/data/drizzle-instance.ts` (`createDb()` without `server-only`).
- **Security contract:** the Drizzle connection uses the service-role credential and **bypasses RLS**. Every Drizzle query must enforce `user_id` ownership explicitly. Live-database isolation suites per entity (`lib/data/tests/*-isolation.integration.test.ts`) exercise this with another user's known IDs (run requires `DATABASE_URL`; skipped in CI without it).
- Public-visibility reads (public profiles) re-implement the RLS SELECT policy in repository code since Drizzle bypasses RLS.
- Cron scripts that touch Drizzle (`scripts/sync-feeds.ts`) require `DATABASE_URL`, not `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`.

## Auth

Supabase Auth with two providers: Google OAuth + email/password. Sessions are managed via cookies through `@supabase/ssr` (see `lib/supabase/server.ts`, `lib/supabase/browser.ts`, `lib/supabase/route-handler.ts` — three client factories for three contexts).

`lib/auth.ts` exports two helpers:

- `requireAuth()` — throws if not authenticated. Use for protected server actions.
- `requireAuthSafe()` — returns `null` user if unauthenticated. Use for optional-auth flows (e.g. public profile pages that show different state for logged-in users).

## Extension ↔ Web App Bridge

The extension does **not** talk to Supabase directly. It authenticates by calling the web app's API routes with `credentials: "include"`, reusing the Supabase session cookie the user already has from signing in on the web app.

| Endpoint                    | Method | Purpose                                                                                                          |
| --------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------- |
| `/api/extension/bookmark`   | POST   | Save a bookmark (reuses the same repository as the web app). Returns 401 if not authenticated, 409 on duplicate. |
| `/api/extension/check`      | GET    | Check if a URL is already saved in a workspace.                                                                  |
| `/api/extension/popup`      | GET    | Popup init: auth state + workspace list + duplicate check in one round-trip.                                     |
| `/api/extension/workspaces` | GET    | List user's workspaces (for the popup's workspace selector).                                                     |

The `externally_connectable` field in `extension/manifest.json` allows the web app to message the extension directly on `https://sheltermark.vercel.app/*`. An X/Twitter content script (`extension/x-capture.ts`) runs on `x.com` / `twitter.com` to extract tweet metadata before saving.

## Metadata Fetching

`lib/metadata/index.ts` runs a multi-strategy pipeline when a bookmark is created or refetched:

1. **URL safety check** — reject private/loopback hosts.
2. **Platform-specific fallback** — e.g. fxtwitter for Twitter, YouTube oembed, Microlink for JS-heavy sites.
3. **HTML extraction** — `cheerio` parse of `<title>`, `<meta>` tags, `<link rel="icon">`.
4. **Favicon resolution** — fall back to Google S2 favicon service if no favicon is found.

Output is a `Metadata` value object: `{ title, description, og_image_url, favicon_url }`. See `lib/metadata/types.ts`.

## Cron Scripts

Three scripts in `scripts/`, each scheduled via GitHub Actions (`.github/workflows/`):

| Script             | Schedule               | Purpose                                                                                                   |
| ------------------ | ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `check-urls.ts`    | Weekly (Sun 18:00 UTC) | Health-check bookmarks in workspaces with `auto_check_broken = true`, not checked in 7 days. Max 500/run. |
| `sync-feeds.ts`    | Every 30 min           | Parse RSS/Atom feeds, insert new entries, create bookmarks from new items.                                |
| `cleanup-trash.ts` | Daily (00:00 UTC)      | Hard-delete trashed bookmarks + workspaces older than the user's `trash_cleanup_interval` (7 or 30 days). |

All three load `dotenv/config`, require `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, and use the service role key (bypasses RLS). They never run inside the Next.js runtime.

`check-urls.ts` is intentionally thin — classification, soft-404 detection, and error categorization live in `lib/link-health/checker.ts` so each rule is unit-testable. See [`docs/adr/0001-broken-status-enum.md`](./adr/0001-broken-status-enum.md) for the broken-link detection design.

## Row Level Security (RLS)

Every table has RLS policies. The web app and extension use the anon key + user's auth context (RLS-enforced). Cron scripts use the service role key (RLS-bypassed, by design — they need to read/write across users).

Invariants enforced at the database level:

- A bookmark's `user_id` must match its workspace's `user_id` (ownership validation).
- Public reads gated by `is_public` on profiles + workspaces.
- Bookmarks are user-scoped — a public workspace is visible to everyone, but the underlying bookmark rows are still owned by the user.
