# Sheltermark

Cross-device bookmark manager. Next.js web app + Chrome extension, backed by Supabase.

- For domain language, read [`CONTEXT.md`](./CONTEXT.md).
- For setup, see [`docs/setup.md`](./docs/setup.md).
- For architecture, see [`docs/architecture.md`](./docs/architecture.md).
- For deployment, see [`docs/deployment.md`](./docs/deployment.md).
- For domain entities and bounded contexts, see [`docs/domain-model.md`](./docs/domain-model.md).
- Architectural decisions are recorded as ADRs in [`docs/adr/`](./docs/adr/). Project layout rules live in [`ADR-0006`](./docs/adr/0006-project-layout.md) — read it before moving or naming files.

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui with BaseUI
- **Backend:** Supabase (Auth, Postgres, Storage)
- **Query:** TanStack Query, server actions
- **Validation:** Zod
- **Extension:** Chrome Extension (Manifest V3), TypeScript, esbuild
- **Package Manager:** Bun (always use `bun`, not `npm`)
- **Lint/Format:** oxlint + oxfmt
- **Tests:** bun test

## Branch Model

- `dev` — default branch, all day-to-day work and AI agent changes land here. Vercel builds a preview deployment on every push.
- `prod` — production branch. Vercel tracks this in **Settings → Environments → Production → Branch Tracking**; pushes here deploy to `sheltermark.vercel.app`. Protected by a GitHub ruleset: no force-push, no deletion, linear history required.
- `main` — retired. Do not create, base PRs, or branch from it. It will be removed once all references are gone.

AI agents: target `dev` (or a feature branch cut from `dev`) — never push to `prod`. Promoting `dev` → `prod` is a deliberate human action (push or merge PR).

## Project Structure

```
/
├── app/                    # Next.js App Router
│   ├── action/             # Server actions (one file per domain: bookmark, workspace, tag, ...)
│   ├── api/                # API routes (extension bridge, og, share, feeds, demo)
│   ├── dashboard/          # Authenticated bookmark UI
│   ├── u/[username]/       # Public profile pages
│   ├── trash/              # Trash & restore UI
│   └── ...                 # auth flows, legal pages, layout, error boundaries
├── components/             # React components (shadcn/ui in components/ui/, untouched by lint)
├── hooks/                  # Client hooks (queries, mutations, keyboard, dialogs)
├── lib/
│   ├── data/               # Drizzle schema, db connections, repositories (one per entity)
│   ├── feeds/              # RSS/Atom parsing (feed-domain infrastructure)
│   ├── import/             # Browser bookmark import parsers
│   ├── link-health/        # URL health checker (used by cron)
│   ├── metadata/           # Multi-strategy URL metadata fetcher (pipeline.ts)
│   ├── mutations/          # TanStack Query mutation wrappers (optimistic UI)
│   ├── queries/            # TanStack Query options (read side)
│   ├── restore/            # Trash restore logic
│   ├── schemas/            # Zod schemas, one per entity
│   ├── services/           # Cross-entity server logic
│   ├── supabase/           # Supabase client factories (client.ts, server.ts, middleware.ts)
│   ├── utils/              # Domain-agnostic helpers only (last resort, see ADR-0006)
│   └── auth.ts             # requireAuth() / requireAuthSafe()
├── hooks/                  # Client hooks, flat: use-*.ts only
├── tests/                  # All tests: unit/, integration/, fixtures/, preload.ts
├── scripts/                # Cron jobs (check-urls, sync-feeds, cleanup-trash) + ext:build
├── supabase/migrations/   # SQL migrations
├── extension/              # Chrome extension (separate build)
├── docs/
│   ├── setup.md            # Local dev setup
│   ├── architecture.md    # Codebase shape & patterns
│   ├── deployment.md       # Vercel + GitHub Actions cron + extension build
│   ├── domain-model.md    # Visual companion to CONTEXT.md (diagrams & entities)
│   ├── adr/                # Architectural Decision Records
│   ├── agents/             # Issue tracker, triage labels, domain doc conventions
│   ├── api/                # Public API contracts (extension-api.md)
│   ├── archive/            # Superseded working papers (historical only)
│   └── policies/           # Access & data policies
└── prd.md                  # (gitignored) Personal planning scratch
```

## Mutation Pattern

All writes follow a 3-layer pattern. Don't bypass it:

1. **Server Action** (`app/action/*.ts`) — gates with `requireAuth()`, calls repository.
2. **Repository** (`lib/data/repositories/*.ts`) — validates with Zod, executes Supabase query.
3. **Client Hook** (`hooks/use-*.ts` or `lib/mutations/*.ts`) — wraps in TanStack Query's `useMutation` with optimistic update.

Reads go through `lib/queries/*.ts` hooks.

## Design Principles

1. **Keyboard-first.** All actions accessible via keyboard (see `hooks/use-bookmark-keyboard.ts`, `hooks/use-bookmark-global-shortcuts.ts`).
2. **Minimal clicks.** Quick actions, smart defaults, optimistic UI.
3. **Fast metadata.** Auto-fetch title, favicon, og:image via a multi-strategy pipeline; never block the UI on it.
4. **Clean UI.** Minimalist, no clutter, focus on content. Function over form.

## Code Standards

- **Strict TypeScript, no `any`.** `tsc --noEmit` must pass.
- **Zod validates at action boundary.** Schemas in `lib/schemas/`.
- **Server components by default.** Use `"use client"` only where interactivity is required.
- **Keyboard-first.** All actions accessible via keyboard. See `hooks/use-bookmark-keyboard.ts`, `hooks/use-bookmark-global-shortcuts.ts`.
- **Follow shadcn/ui patterns.** Components in `components/ui/` are vendored — don't hand-edit; regenerate via `shadcn` CLI.
- **Do not add comments proactively** Only add comments for non-obvious intent, business rules, constraints, workarounds, security considerations, or important trade-offs.
- **Do not add tests solely to increase coverage**

## Working Rules

- **All user interactions must be in English.**
- **Don't make changes with assumptions — always ask the user first.**
- **Git operations are read-only by default.** Don't commit, push, or amend unless explicitly asked.
- **Use `bun`, never `npm`.**

## Common Commands

```bash
bun install              # install deps
bun run dev              # Next.js dev server (http://localhost:3000)
bun run build            # production build
bun run lint             # oxlint check (read-only)
bun run format           # oxfmt format
bun run format:check     # oxfmt check
bun run check:types      # tsc --noEmit
bun run test             # bun test --isolate
bun run test:watch       # bun test --isolate --watch
bun run knip             # find dead code
bun run ext:build        # build extension to extension/dist/
bun run ext:watch        # esbuild watch for extension
bun run check:urls-health   # run URL health check locally (needs SUPABASE_* env)
bun run sync-feeds        # sync RSS feeds locally
bun run cleanup-trash     # run trash cleanup locally
```

## Agent Skills

### Issue tracker

GitHub Issues. See [`docs/agents/issue-tracker.md`](./docs/agents/issue-tracker.md).

### Triage labels

Default label names (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See [`docs/agents/triage-labels.md`](./docs/agents/triage-labels.md).

### Domain docs

Single-context: one `CONTEXT.md` (glossary) + `docs/adr/` at repo root. See [`docs/agents/domain.md`](./docs/agents/domain.md).
