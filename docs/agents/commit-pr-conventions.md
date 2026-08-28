# Commit & PR Conventions

Binding rules for every commit and pull request in this repo — agents and
humans alike. Referenced from `AGENTS.md`; read this before committing or
opening a PR.

## Commits

- **Conventional commits**: `type(scope): imperative summary`
  - Types: `feat`, `fix`, `chore`, `ci`, `docs`, `refactor`, `test`
  - Scope is the domain or area touched: `bookmark`, `landing`, `devx`,
    `branding`, … Omit only for repo-wide changes.
- Subject line: imperative mood, ≤ 72 characters, no trailing period.
- Body (when needed): _why_ the change exists and what it does, as bullets
  wrapped at ~72 chars. Skip the body for self-evident changes.
- One logical change per commit. A small working diff beats a large perfect
  one — don't let changes pile up.
- Never commit secrets. `.env*` files are gitignored; keep them that way.
- Pre-commit hooks run oxlint + oxfmt on staged files. Fix the finding;
  never bypass with `--no-verify`.
- Agents: commit only when explicitly asked.

## Pull Requests

- PRs target **`dev`** — never `prod`. Promoting `dev → prod` is a deliberate
  human action (see below).
- PR title uses the same conventional-commit format. PRs are squash-merged,
  so the title becomes the commit message on `dev`.
- PR description states: what changed, why, and how it was verified
  (commands run, test results, screenshots for UI changes).
- CI must be green before merge: lint, format, typecheck, tests, and the
  schema drift guard.
- Link the issue being resolved (`Fixes #123`) when one exists.

## Promotion dev → prod

- Human-only. Either push `dev` to `prod` or open a merge PR
  (`chore: promote dev to prod`).
- Migrations ride along automatically: `deploy-migrations.yml` applies any
  new migrations on push to `prod`. Keep migrations additive so the Vercel
  code deploy and the migration run can race safely.
