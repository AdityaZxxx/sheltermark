import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Narrow, owned seam for repository dependencies.
 *
 * Repositories accept this instead of `SupabaseClient` so tests can supply
 * a fake. The real `SupabaseClient` satisfies this structurally.
 *
 * Grows test-first: only methods a repository actually uses are added.
 * Don't mirror the full Supabase API — add a capability here only when a
 * repository migration requires it.
 *
 * Shape definitions (Row, etc.) live alongside the repositories that own
 * those row types; this interface deliberately stays structural.
 */

/** A row in any table — keyed by string columns, JSON-serializable values. */
export type DbRow = Record<string, unknown>;

/** PostgREST-style result envelope. */
export type DbResult<T> = { data: T | null; error: DbError | null };

/** PostgREST-style error. Minimal — only fields the repos branch on. */
export type DbError = { message: string; code: string };

/**
 * Terminal — the result of `.single()` or `.maybeSingle()`. Just awaitable.
 * Supabase's `PostgrestBuilder` doesn't expose `.order()` here — ordering
 * happens before the terminal.
 */
export interface DbQueryTerminal<TData> extends PromiseLike<DbResult<TData>> {}

/**
 * Filter-builder returned by `DbClient.from().select(...)`.
 *
 * Each filter returns `this` (chainable) and narrows the working row set.
 * `.order()` sorts; `.single()`/`.maybeSingle()` terminate.
 */
export interface DbQueryBuilder<TData> extends DbQueryTerminal<TData> {
  eq(column: string, value: unknown): this;
  neq(column: string, value: unknown): this;
  in(column: string, values: readonly unknown[]): this;
  is(column: string, value: null): this;
  not(column: string, operator: "is", value: null): this;
  order(
    column: string,
    opts?: { ascending?: boolean; nullsFirst?: boolean },
  ): this;
  single(): DbQueryTerminal<DbRow>;
  maybeSingle(): DbQueryTerminal<DbRow>;
}

/**
 * Builder returned by `.from(table)`. Repos begin every query here.
 */
export interface DbFromBuilder {
  select(columns?: string): DbQueryBuilder<DbRow[]>;
  insert(rows: DbRow | DbRow[]): DbInsertBuilder;
  update(values: DbRow): DbMutationBuilder;
  delete(): DbMutationBuilder;
}

export interface DbInsertBuilder extends PromiseLike<DbResult<DbRow[]>> {
  select(columns?: string): this;
  single(): DbQueryTerminal<DbRow>;
}

export interface DbMutationBuilder extends PromiseLike<DbResult<null>> {
  eq(column: string, value: unknown): this;
  in(column: string, values: readonly unknown[]): this;
  is(column: string, value: null): this;
  not(column: string, operator: "is", value: null): this;
}

/**
 * The seam itself. Real `SupabaseClient` satisfies this structurally.
 */
export interface DbClient {
  from(table: string): DbFromBuilder;
  rpc(
    fn: string,
    args?: Record<string, unknown>,
  ): PromiseLike<DbResult<unknown>>;
}

/**
 * Type-level check that `SupabaseClient` satisfies `DbClient`.
 * If this fails to compile, the structural assumption is broken.
 */
export type _SupabaseSatisfiesDbClient = SupabaseClient extends DbClient
  ? true
  : never;
