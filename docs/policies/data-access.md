# Data Access Policy

Status: **active**. Applies to every maintainer, agent, and automation that can
reach Sheltermark production data. Changes to this policy require a pull request.

## 1. Why this document exists

Two different things are easy to conflate:

- **Technical capability** — which connections _can_ touch user data.
- **Authorized access** — which accesses are _permitted_ by this policy.

The web app's data layer and all cron jobs hold service-role credentials that
technically bypass Row Level Security entirely. That capability is intrinsic to
how the system is built; it is not permission. This policy defines when that
capability may legitimately be used, and requires an audit trail for when it is.

## 2. Principles

1. **User bookmarks are private by default.** `is_public` defaults to `false` at
   the database level, in Zod schemas, and in the UI. Public visibility is an
   explicit, per-item opt-in by the user.
2. **Bookmark content is private user data.** URLs, titles, notes, tags, feed
   URLs and feed entries are treated as sensitive. Aggregate statistics that
   cannot be traced back to a user's content (counts, broken-link rates, sync
   totals) are not.
3. **Ordinary access is not privileged access.** A user reading and writing
   their own data through the authenticated app is governed by authentication,
   ownership scoping in the repository layer, and RLS. It requires no audit
   record.
4. **Privileged access is the exception.** Any access that crosses a user
   boundary or bypasses RLS is privileged and must satisfy section 3.

## 3. Authorized purposes

Privileged access to user data is permitted only for:

- **Operational** — scheduled maintenance the user benefits from and implicitly
  opted into by using the product: feed sync, URL health checks in enabled
  workspaces, trash cleanup honoring each user's retention preference.
- **Security** — abuse investigation, credential or breach response.
- **Debugging** — reproducing and fixing a specific reported problem
  (see section 4.5).
- **Legal** — compliance with a valid legal request.

**Never permitted:** curiosity, profiling, analytics, product research over
bookmark content, model training, or anything not reducible to a purpose above.
Product analytics uses UI interaction telemetry only (see the privacy policy)
and never reads bookmark rows.

All privileged access must be scoped to the minimum data necessary for the
purpose. Prefer metadata, aggregates, and identifiers over inspecting content.

## 4. Rules by surface

### 4.1 Application request paths

Server actions and API routes act on behalf of exactly one authenticated user.
Repository queries are bound to the caller's `user_id`; public reads
re-implement the `is_public` SELECT policy in code because the Drizzle
connection bypasses RLS. This is ordinary access — no audit event is produced,
and no audit event is required.

### 4.2 Cron jobs (operational, audited)

`check-urls.ts`, `cleanup-trash.ts`, and `sync-feeds.ts` run on service-role
credentials and cross user boundaries. Each run records at least one event in
`audit_events` (see section 5) before it exits. Events carry counts and scopes
only — never URLs, titles, or other content.

Cron jobs must not gain new user-data capabilities without a corresponding
policy review, audit wiring, and explicit reason strings.

### 4.3 Production credentials

- `SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL` are server-side secrets. They
  live in Vercel environment variables and GitHub Actions secrets — never with a
  `NEXT_PUBLIC_` prefix, never in the extension bundle, never in logs, never
  committed.
- Local copies belong in a developer's `.env` / `supabase/.temp/` (both
  gitignored) and are never pasted into chats, tickets, screenshots, or docs.

### 4.4 Development data

Develop against local or synthetic data. Production user data — particularly
bookmark content — is never exported to developer machines. If a live incident
genuinely requires production context, use aggregates or content-redacted
samples, and do not retain them.

### 4.5 Support and debugging

- Debugging that touches user data requires a **documented reason** — an issue
  link or incident note — recorded as the `reason` field of an `audit_events`
  row with `actor_type = 'developer'`.
- Prefer metadata, aggregates, counts, and IDs over content inspection.
- Scope access to the specific user and rows needed to reproduce the issue;
  no bulk exports.
- Access ends when the investigation ends.

### 4.6 Future multi-maintainer access

If more maintainers join: no shared credentials (each person gets individually
scoped access), per-person audit identities (`developer:<handle>`), and a
regular review of `audit_events` by the project owner. Until then, the
single-maintainer constraint is itself a control — anyone holding the secrets
is the owner and is still bound by this policy.

## 5. The audit trail

### 5.1 The table

`public.audit_events` (added by
`supabase/migrations/20260820055630_add_audit_events.sql`):

| Column          | Meaning                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `id`            | UUID primary key.                                                                                                        |
| `actor_type`    | `cron`, `developer`, or `system` (CHECK-constrained).                                                                    |
| `actor_id`      | Machine identity, e.g. `cron:sync-feeds#42`. Identifier grammar (CHECK) — no URL, email, path, or prose can appear here. |
| `action`        | Dot-namespaced event name, e.g. `feed_sync.run`.                                                                         |
| `resource_type` | Structural resource class, e.g. `bookmark`, `feed`, `trash`.                                                             |
| `resource_id`   | Optional UUID of the single resource touched (never an email/username).                                                  |
| `reason`        | Human-readable justification (3–500 chars, CHECK-constrained, required).                                                 |
| `metadata`      | Flat map of identifier-like token primitives (counts, scopes, flags) only.                                               |
| `created_at`    | Event timestamp (UTC).                                                                                                   |

Events are inserted through `lib/audit.ts`, whose Zod schema enforces the
content rules below before anything reaches the database. The same bounds are
mirrored as CHECK constraints in the migration, so they hold for any writer
that bypasses the module.

### 5.2 Content rules for audit records

Never store bookmark URLs, titles, notes, feed URLs, feed content, emails, or
any other user content. Enforced in two layers:

- **Application layer (lib/audit.ts):** metadata keys matching a
  content-word blocklist (`url`, `title`, `note`, `content`, `email`, …) are
  rejected; nested objects/arrays are rejected; all remaining string keys and
  values must be identifier-like tokens (no spaces, `/`, or `@`). `resource_id`
  is UUID-only.
- **Database layer (CHECK constraints in the migration):** every free-form
  column is validated against a machine-identifier grammar, and
  `audit_metadata_is_content_free()` walks every key and value of `metadata`,
  rejecting anything containing spaces, `/`, or `@`.

`reason` is the only prose column; it must reference the justification for the
access (issue link, incident note) and must not itself quote user content.

### 5.3 What counts as privileged access today

| Actor                         | Event(s) recorded                                                                                         | Granularity                 |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------- |
| `cron:check-urls#<run-id>`    | `url_health_check.run` — bookmarks checked/updated across users.                                          | One per run                 |
| `cron:cleanup-trash#<run-id>` | `trash_cleanup.run` — totals; plus `trash_cleanup.hard_delete_user` per user whose data was hard-deleted. | Per run + per affected user |
| `cron:sync-feeds#<run-id>`    | `feed_sync.run` — feeds synced across users.                                                              | One per run                 |

Deliberately **not** audited:

- Ordinary per-user CRUD through the web app and extension. It is governed by
  authentication and ownership scoping; logging it would flood the trail with
  noise and add no signal about privilege misuse.
- Ad-hoc database access with the same credentials outside the app (psql,
  Supabase dashboard). The application cannot observe it. It is controlled by
  restricting who holds the secrets, by GitHub Actions / Vercel logs, and by
  section 4.6's identity rules.

### 5.4 Integrity and retention

- Effectively append-only: no code path updates audit rows, and the `updated_at`
  machinery used by other tables is intentionally absent. Deletion is only ever
  an explicit retention decision, never a side effect.
- RLS is enabled with **zero policies**, so application users (anon and
  authenticated roles) can neither read nor write the table. Service-role
  connections bypass RLS by definition — the practical guarantee is code review
  plus the fact that the only writers are the cron entrypoints and
  `lib/audit.ts`.
- A privileged operation that fails to write its audit event is treated as a
  failed run: cron scripts log the error and exit non-zero.
- Retain audit rows for at least 12 months. There is no automated purging yet;
  deletion happens manually under this policy.

## 6. Enforcement and known limits

Enforced in code: Zod validation of every audit event, CHECK constraints on
`actor_type` and `reason`, RLS with no user-facing policies, and CI failure on
audit write errors. Enforced by process: this policy and pull-request review.

Honest limits — service-role credentials can read anything, including this
audit table, and Supabase dashboard access is outside the application's reach.
The audit trail answers "what privileged operations ran and why", not "prove a
secret was never misused". Closing that gap requires per-person database roles
or Supabase-side access controls, deferred until multi-maintainer access exists
(section 4.6).
