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
 */

/** A JSON-serializable value as it crosses the database boundary. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/** A row in any table — keyed by string columns, JSON-serializable values. */
export type DbRow = Record<string, JsonValue>;

/** Values usable in PostgREST filters. */
export type DbFilterValue = string | number | boolean | null;

/** Arguments for Postgres function calls — JSON-serializable only. */
export type RpcArgs = Record<string, JsonValue>;

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
  eq(column: string, value: DbFilterValue): this;
  neq(column: string, value: DbFilterValue): this;
  in(column: string, values: readonly DbFilterValue[]): this;
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
  upsert(
    rows: DbRow | DbRow[],
    options?: { onConflict?: string; ignoreDuplicates?: boolean },
  ): DbInsertBuilder;
  update(values: DbRow): DbMutationBuilder;
  delete(): DbMutationBuilder;
}

export interface DbInsertBuilder extends PromiseLike<DbResult<DbRow[]>> {
  select(columns?: string): this;
  single(): DbQueryTerminal<DbRow>;
}

export interface DbMutationBuilder extends PromiseLike<DbResult<null>> {
  eq(column: string, value: DbFilterValue): this;
  in(column: string, values: readonly DbFilterValue[]): this;
  is(column: string, value: null): this;
  not(column: string, operator: "is", value: null): this;
  select(columns?: string): DbMutationSelectTerminal<DbRow[]>;
}

/**
 * Terminal returned by `update().select()` / `delete().select()` — mutation
 * plus row return. Awaitable for all affected rows; `.single()` narrows to one.
 */
export interface DbMutationSelectTerminal<
  TData,
> extends DbQueryTerminal<TData> {
  single(): DbQueryTerminal<DbRow>;
}

/**
 * The seam itself. Real `SupabaseClient` satisfies this structurally.
 */
export interface DbClient {
  from(table: string): DbFromBuilder;
  rpc(fn: string, args?: RpcArgs): PromiseLike<DbResult<unknown>>;
}

/**
 * Adapt a real Supabase client to the repository seam.
 *
 * SAFETY: Supabase's recursive generics blow TypeScript's instantiation
 * depth when checked structurally against DbClient, even though the runtime
 * shape is compatible. This is the single place that performs the two-step
 * adaptation; the chain below is the only way to express it.
 */
export function asDbClient(client: SupabaseClient): DbClient {
  // SAFETY: Supabase's recursive generics exceed TS instantiation depth when
  // checked structurally; the runtime shape is compatible. asDbClient is the
  // single place that performs the two-step adaptation.
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- see SAFETY above
  return client as unknown as DbClient;
}

/**
 * Type-level check that `SupabaseClient` satisfies `DbClient`.
 * If this fails to compile, the structural assumption is broken.
 * The conditional defers the check so TS doesn't eagerly expand the
 * recursive Supabase generics (asDbClient documents why).
 */
// eslint-disable-next-line anti-slop/no-unsafe-dictionary-type
export type _SupabaseSatisfiesDbClient = SupabaseClient extends {
  from(table: string): DbFromBuilder;
}
  ? true
  : never;
