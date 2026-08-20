# Project layout: hybrid layer-first with per-boundary naming grammars

**Date**: 2026-08-20
**Status**: Accepted

The repository was restructured from an inconsistent place-per-concern layout
(the same kind of file lived in different homes depending on when it was added)
to a hybrid layer-first layout: top-level directories encode the architectural
role (`app/` routes, `components/` UI, `hooks/` client hooks, `lib/` server
and shared infrastructure, `scripts/` cron, `tests/` suites), while genuinely
domain-specific infrastructure is allowed its own layer folder (`lib/feeds/`,
`components/share/`, `components/tag/`, …) rather than dumped into grab-bag
folders.

The naming rule is **boundary-aware, not universal**: the repository uses
different naming grammars according to architectural boundary rather than
forcing one convention everywhere.

- Domain code is singular and keeps role suffixes:
  `app/action/bookmark.action.ts`, `lib/schemas/tag.schema.ts`,
  `lib/data/repositories/bookmark.repository.ts`, `lib/queries/feed.queries.ts`,
  `lib/mutations/workspace.mutations.ts`.
- UI product concepts keep idiomatic UI names even when plural:
  `components/settings/` is the Settings UI; a `config/`-style singular here
  would be worse, not cleaner.
- Public API paths (`/api/extension/*`) are a contract consumed by the
  already-deployed extension and are not renamed for naming consistency;
  see `docs/api/extension-api.md`.
- `lib/utils/` is a last resort: a helper belongs there only if it is
  genuinely domain-agnostic. Anything domain-tied goes in the domain's folder.
- `tests/` is central and flat by category (`tests/unit/`,
  `tests/integration/`); the directory communicates the category, so file
  names do not repeat it.

Two deliberate deviations from "no barrel files": `lib/utils/index.ts` is the
entry point for the shadcn `utils` alias declared in `components.json`, so it
must exist; and `lib/data/schema.ts` keeps its short name because `schema` is
already unambiguous inside `data/`.

This ADR records the principles, not an exhaustive directory manifest — the
tree may evolve without amending it, as long as new files follow the rules
above.
