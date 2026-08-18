# Introduce `DbClient` seam and `FakeDbClient` for repository testing

**Date**: 2026-07-23
**Status**: Superseded

> Superseded by the Drizzle migration (2026-08). `lib/data/db-client.ts` and `FakeDbClient` were deleted; repositories now take `DrizzleDb` directly (see `docs/architecture.md` "Data layer"). The replacement test seam is the real database: live-database isolation suites in `lib/data/__tests__/*-isolation.integration.test.ts` exercise the exact service-role/RLS-bypassed posture, and `insertBookmark` keeps an injected `fetchMetadataFn` seam for deterministic non-network tests. The test-first rule and `peek()` design notes below are kept as historical record.

## Context

The repository layer (`lib/data/repositories/*`, `lib/restore/index.ts`) contained the codebase's highest branching complexity — duplicate detection, move-skip logic, batch insert strategy, restore workspace grouping — yet had zero test coverage. Pure functions had been extracted and tested (classifiers, invalidation updaters), but anything with a real Supabase dependency was untested.

The repositories already accepted `SupabaseClient` as their first parameter — the seam existed, but only one adapter (real Supabase) was wired. No in-memory adapter meant no test could cross that seam.

## Decision

Introduce a narrow, owned `DbClient` interface (`lib/data/db-client.ts`) that repositories depend on instead of `SupabaseClient`. The real `SupabaseClient` satisfies it structurally; a new `FakeDbClient` (`lib/data/__tests__/fake-db-client.ts`) implements it for tests.

### Why `DbClient` instead of `SupabaseClient` directly

- `SupabaseClient` is a large recursive generic type. Depending on it forces tests to either use a real client (integration tests against Postgres) or a partial mock that stubs 50+ unused methods.
- `DbClient` narrows the surface to exactly the query-builder subset the repositories use: `from().select().eq().in().is().not().order().single().maybeSingle()`, plus `insert()`, `update()`, `delete()`, and `rpc()`.
- TypeScript cannot structurally verify that `SupabaseClient` satisfies `DbClient` without hitting the instantiation-depth limit (recursive generics). The cast `supabase as unknown as DbClient` at the action-layer boundary is the documented compromise — runtime shape is compatible, the type system just can't prove it.

### Why `FakeDbClient` is not a Supabase reimplementation

`FakeDbClient` is a stateful in-memory simulation, not a faithful Supabase clone. It deliberately omits:

- **Column projection** — `select("id, url")` returns full rows. Tests assert on row presence and field values, not column shape.
- **Nested selects / joins** — not implemented. If `exportBookmarks` later needs testing, add a narrowly scoped special case.
- **Constraint violations** — no unique-index errors, no `23505` codes. The minimal error model is: success, `.maybeSingle()` → null on zero rows, `.single()` → `PGRST116` on zero rows.
- **RLS, auth, realtime, storage** — out of scope. `profile.repository.ts` and `feed.repository.ts` are not migrated (they pull in `supabase.storage`, `supabase.auth`, `fetchMetadata`, `parseFeed`).

### The test-first rule

Every new capability added to `DbClient` or `FakeDbClient` must be introduced by a failing repository test. Do not preemptively add operators, terminal methods, or error behaviours "because they're likely needed." This prevents the fake from gradually becoming a Supabase reimplementation.

Capabilities added during Phase 1, each justified by existing repository code:

- `.is()` / `.not(col, "is", null)` on `DbMutationBuilder` — `batchInsertBookmarks` and `emptyTrashBookmarks` use them.
- `rpc()` on `DbClient` — `transaction.ts` calls `supabase.rpc("delete_workspace_with_bookmarks", ...)`.

### `peek()` is test-only

`FakeDbClient.peek(table)` returns a deep-cloned, frozen snapshot of a table's rows. It is not part of `DbClient` and must never become part of it. Tests assert on `peek()` output instead of re-querying through the fake, keeping the mutation path and the inspection path independent — a filter bug in `select` cannot mask a filter bug in the repository's duplicate check.

## Consequences

- Repository functions accept `DbClient` instead of `SupabaseClient`. Call sites in `app/action/*.ts` and `app/api/extension/bookmark/route.ts` cast through `unknown as DbClient` at the composition boundary.
- `tag.service.ts` still depends on `SupabaseClient` — it receives `supabase as unknown as SupabaseClient` from `bookmark.repository.ts` until Phase 2 migrates it.
- `feed.repository.ts` and `profile.repository.ts` remain on `SupabaseClient` — out of scope unless they independently demonstrate a need for stateful testing.
- New repository functions should depend on `DbClient`, not `SupabaseClient`. If a new function needs a capability `DbClient` doesn't have, add it test-first.

## Scope of Phase 1

Migrated and tested:

- `bookmark.repository.ts` — all 13 functions
- `restore/index.ts` — both functions
- `workspace.repository.ts` — all 15 functions (migrated, not yet tested for branching)
- `transaction.ts` — both functions (migrated, `rpc()` added to `DbClient`)

15 new tests covering: `insertBookmark` (duplicate detection, null workspace), `moveBookmarks` (duplicate skip), `batchInsertBookmarks` (skip + replace strategies), `restoreBookmarks` (grouping, duplicate skip, mixed batch, target workspace), `restoreWorkspace` (cascade, duplicate skip, empty workspace).

Phase 2 (`tag.repository.ts`, `tag.service.ts`) is a separate effort, to be driven by its own testing needs.
