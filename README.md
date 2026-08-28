# Sheltermark

A cross-device bookmark manager. Save URLs that are auto-enriched with metadata, organize them into workspaces, and optionally share public collections.

## Documentation

| Doc                                            | For                                                                                 |
| ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| [docs/setup.md](./docs/setup.md)               | Local dev: env vars, install, DB migrations, extension loading.                     |
| [docs/architecture.md](./docs/architecture.md) | Codebase shape: request flow, mutation pattern, cron scripts, extension↔web bridge. |
| [docs/deployment.md](./docs/deployment.md)     | Vercel, GitHub Actions cron, extension build & package.                             |
| [docs/domain-model.md](./docs/domain-model.md) | Bounded contexts, entities, invariants, domain events.                              |
| [CONTEXT.md](./CONTEXT.md)                     | Glossary — the project's ubiquitous language.                                       |
| [AGENT.md](./AGENT.md)                         | Conventions and working rules for AI agents (and humans).                           |
| [docs/adr/](./docs/adr/)                       | Architectural Decision Records.                                                     |

## Features

- **Smart bookmarks** — auto-fetch title, favicon, and OG image from any URL via a multi-strategy metadata pipeline.
- **Workspaces** — organize bookmarks into public or private collections; one default workspace per user.
- **Tags** — lightweight, user-scoped labels via many-to-many junction. Cheap and disposable.
- **Feeds** — subscribe to RSS/Atom; new items become bookmarks automatically (cron-synced every 30 min).
- **Link health** — weekly cron checks saved URLs, classifies as `alive | confirmed_broken | likely_broken | unknown`. Soft-404 detection, per-host throttling, 401/403 treated as ambiguous.
- **Trash & restore** — soft-delete with per-user cleanup interval (7 or 30 days, enforced by daily cron).
- **Public profiles** — share curated collections at `/u/[username]`.
- **Import/export** — JSON and CSV, with duplicate strategy (`skip` or `replace`) and a dry-run preview.
- **Chrome extension** — one-click save (Ctrl+Shift+K) with workspace selector and X/Twitter-specific capture.

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui with BaseUI
- **Backend:** Supabase (Auth, Postgres, Storage)
- **State:** TanStack Query + server actions
- **Validation:** Zod
- **Extension:** Manifest V3, TypeScript, esbuild
- **Package Manager:** Bun
- **Tests:** Native Bun
- **Lint/Format:** Biome

## Quickstart

```bash
bun install
cp .env.example .env   # then fill in the values (see docs/setup.md)
bun run dev             # http://localhost:3000
```

For the extension, database migrations, and deployment, see [docs/setup.md](./docs/setup.md) and [docs/deployment.md](./docs/deployment.md).

## Browser Extension

Chrome / Edge / Brave:

1. Build the extension: `bun run ext:build`
2. Open `chrome://extensions/`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the `extension/` folder

For local dev, set the web app URL via the extension's options page (chrome://extensions → Sheltermark → Details → Extension options). See [docs/setup.md](./docs/setup.md).

## Roadmap

- [x] Web app with workspaces
- [x] Public profile pages
- [x] Auto-metadata fetching
- [x] Chrome extension (not yet in the Web Store — registration payment issue)
- [x] Import/export (JSON + CSV)
- [x] Android PWA share intent
- [x] RSS/Atom feed subscriptions
- [x] Bookmark notes and tagging
- [x] Trash with auto-cleanup
- [x] Link health checks
- [x] Full-text search
- [x] Import from browser bookmarks
- [x] AI integration for bookmark search, title, and tags
- [x] Inline bookmark preview
