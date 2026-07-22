/* biome-ignore-all lint/suspicious/noThenProperty: this file implements PromiseLike thenables to satisfy DbClient's thenable contract */
import type {
  DbClient,
  DbError,
  DbFromBuilder,
  DbInsertBuilder,
  DbMutationBuilder,
  DbQueryBuilder,
  DbQueryTerminal,
  DbResult,
  DbRow,
} from "~/lib/data/db-client";

/**
 * In-memory stateful fake of {@link DbClient}.
 *
 * Narrow and repository-driven: implements only the query-builder subset
 * Sheltermark's repositories actually use. Not a reimplementation of
 * Supabase — every behavior here exists because a repository test
 * requires it (test-first growth).
 *
 * Lifecycle: construct a fresh fake per test with the exact initial
 * state needed. No `seed()` or `reset()` — tests stay isolated by
 * construction.
 *
 * Inspection: {@link peek} returns a deep-cloned, frozen snapshot of a
 * table's rows. Tests assert on it instead of re-querying through the
 * fake, keeping mutation and inspection code paths independent.
 *
 * Error model: minimal. `.maybeSingle()` on zero rows returns
 * `{ data: null, error: null }`; `.single()` on zero rows returns
 * `{ data: null, error: { code: "PGRST116", ... } }`. No constraint
 * simulation, no error codes — add test-first when a test requires it.
 *
 * Column projection: ignored. `select("id, url")` returns full rows.
 * Tests assert on row presence and field values, not column shape.
 */

type TableName = string;

type FilterOp =
  | { kind: "eq"; column: string; value: unknown }
  | { kind: "neq"; column: string; value: unknown }
  | { kind: "in"; column: string; values: readonly unknown[] }
  | { kind: "is-null"; column: string }
  | { kind: "is-not-null"; column: string };

type SortSpec = {
  column: string;
  ascending: boolean;
  nullsFirst: boolean;
};

function deepClone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    Object.freeze(value);
    for (const item of value) deepFreeze(item);
  } else {
    Object.freeze(value);
    for (const key of Object.keys(value as object)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

function matches(row: DbRow, filter: FilterOp): boolean {
  const actual = row[filter.column];
  switch (filter.kind) {
    case "eq":
      return actual === filter.value;
    case "neq":
      return actual !== filter.value;
    case "in":
      return filter.values.includes(actual);
    case "is-null":
      return actual === null || actual === undefined;
    case "is-not-null":
      return actual !== null && actual !== undefined;
  }
}

function applyFilters(rows: DbRow[], filters: FilterOp[]): DbRow[] {
  if (filters.length === 0) return rows;
  return rows.filter((row) => filters.every((f) => matches(row, f)));
}

function applySorts(rows: DbRow[], sorts: SortSpec[]): DbRow[] {
  if (sorts.length === 0) return rows;
  const sorted = [...rows];
  sorted.sort((a, b) => {
    for (const spec of sorts) {
      const av = a[spec.column];
      const bv = b[spec.column];
      const aNull = av === null || av === undefined;
      const bNull = bv === null || bv === undefined;
      if (aNull && bNull) continue;
      if (aNull) return spec.nullsFirst ? -1 : 1;
      if (bNull) return spec.nullsFirst ? 1 : -1;
      if (av === bv) continue;
      const cmp = av < bv ? -1 : 1;
      return spec.ascending ? cmp : -cmp;
    }
    return 0;
  });
  return sorted;
}

/** Terminal returned by `.single()` / `.maybeSingle()`. Awaitable only. */
class FakeQueryTerminal<TData> implements DbQueryTerminal<TData> {
  constructor(
    private readonly table: TableName,
    private readonly store: Map<TableName, DbRow[]>,
    private readonly filters: FilterOp[],
    private readonly sorts: SortSpec[],
    private readonly mode: "single" | "maybeSingle",
  ) {}

  private resolve(): DbResult<TData> {
    const rows = this.store.get(this.table) ?? [];
    const filtered = applySorts(applyFilters(rows, this.filters), this.sorts);

    if (this.mode === "maybeSingle") {
      return {
        data: filtered[0] ? (deepClone(filtered[0]) as unknown as TData) : null,
        error: null,
      };
    }
    // single
    if (filtered.length === 0) {
      const error: DbError = {
        message: "JSON object requested, multiple (or no) rows returned",
        code: "PGRST116",
      };
      return { data: null, error };
    }
    return {
      data: deepClone(filtered[0]) as unknown as TData,
      error: null,
    };
  }

  then<TResult1 = DbResult<TData>, TResult2 = never>(
    onFulfilled?:
      | ((value: DbResult<TData>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.resolve()).then(onFulfilled, onRejected);
  }

  [Symbol.toStringTag] = "FakeQueryTerminal";
}

class FakeQueryBuilder<TData> implements DbQueryBuilder<TData> {
  private filters: FilterOp[] = [];
  private sorts: SortSpec[] = [];

  constructor(
    private readonly table: TableName,
    private readonly store: Map<TableName, DbRow[]>,
  ) {}

  eq(column: string, value: unknown): this {
    this.filters.push({ kind: "eq", column, value });
    return this;
  }

  neq(column: string, value: unknown): this {
    this.filters.push({ kind: "neq", column, value });
    return this;
  }

  in(column: string, values: readonly unknown[]): this {
    this.filters.push({ kind: "in", column, values });
    return this;
  }

  is(column: string, value: null): this {
    if (value === null) {
      this.filters.push({ kind: "is-null", column });
    } else {
      this.filters.push({ kind: "is-not-null", column });
    }
    return this;
  }

  not(column: string, operator: "is", value: null): this {
    if (operator === "is" && value === null) {
      this.filters.push({ kind: "is-not-null", column });
    }
    return this;
  }

  order(
    column: string,
    opts: { ascending?: boolean; nullsFirst?: boolean } = {},
  ): this {
    this.sorts.push({
      column,
      ascending: opts.ascending ?? true,
      nullsFirst: opts.nullsFirst ?? false,
    });
    return this;
  }

  single(): DbQueryTerminal<DbRow> {
    return new FakeQueryTerminal<DbRow>(
      this.table,
      this.store,
      this.filters,
      this.sorts,
      "single",
    );
  }

  maybeSingle(): DbQueryTerminal<DbRow> {
    return new FakeQueryTerminal<DbRow>(
      this.table,
      this.store,
      this.filters,
      this.sorts,
      "maybeSingle",
    );
  }

  private resolve(): DbResult<TData> {
    const rows = this.store.get(this.table) ?? [];
    const filtered = applySorts(applyFilters(rows, this.filters), this.sorts);

    return {
      data: deepClone(filtered) as unknown as TData,
      error: null,
    };
  }

  then<TResult1 = DbResult<TData>, TResult2 = never>(
    onFulfilled?:
      | ((value: DbResult<TData>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.resolve()).then(onFulfilled, onRejected);
  }

  [Symbol.toStringTag] = "FakeQueryBuilder";
}

class FakeMutationBuilder implements DbMutationBuilder {
  private filters: FilterOp[] = [];

  constructor(
    private readonly table: TableName,
    private readonly store: Map<TableName, DbRow[]>,
    private readonly kind: "update" | "delete",
    private readonly values?: DbRow,
  ) {}

  eq(column: string, value: unknown): this {
    this.filters.push({ kind: "eq", column, value });
    return this;
  }

  in(column: string, values: readonly unknown[]): this {
    this.filters.push({ kind: "in", column, values });
    return this;
  }

  is(column: string, value: null): this {
    if (value === null) {
      this.filters.push({ kind: "is-null", column });
    } else {
      this.filters.push({ kind: "is-not-null", column });
    }
    return this;
  }

  not(column: string, operator: "is", value: null): this {
    if (operator === "is" && value === null) {
      this.filters.push({ kind: "is-not-null", column });
    }
    return this;
  }

  private resolve(): DbResult<null> {
    const rows = this.store.get(this.table) ?? [];
    const matching = applyFilters(rows, this.filters);

    if (this.kind === "update") {
      const now = this.values ?? {};
      for (const row of matching) {
        for (const [k, v] of Object.entries(now)) {
          row[k] = v;
        }
      }
    } else {
      this.store.set(
        this.table,
        rows.filter((r) => !matching.includes(r)),
      );
    }
    return { data: null, error: null };
  }

  then<TResult1 = DbResult<null>, TResult2 = never>(
    onFulfilled?:
      | ((value: DbResult<null>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.resolve()).then(onFulfilled, onRejected);
  }

  [Symbol.toStringTag] = "FakeMutationBuilder";
}

class FakeInsertBuilder implements DbInsertBuilder {
  constructor(
    private readonly table: TableName,
    private readonly store: Map<TableName, DbRow[]>,
    private readonly rows: DbRow[],
  ) {}

  select(_columns?: string): this {
    return this;
  }

  single(): DbQueryTerminal<DbRow> {
    return new FakeInsertSingleTerminal(this.table, this.store, this.rows);
  }

  private resolve(): DbResult<DbRow[]> {
    const rows = this.store.get(this.table) ?? [];
    rows.push(...deepClone(this.rows));
    this.store.set(this.table, rows);
    return { data: deepClone(this.rows), error: null };
  }

  then<TResult1 = DbResult<DbRow[]>, TResult2 = never>(
    onFulfilled?:
      | ((value: DbResult<DbRow[]>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.resolve()).then(onFulfilled, onRejected);
  }

  [Symbol.toStringTag] = "FakeInsertBuilder";
}

/** `.insert(...).select().single()` — terminal that inserts then returns one. */
class FakeInsertSingleTerminal implements DbQueryTerminal<DbRow> {
  private sorts: SortSpec[] = [];

  constructor(
    private readonly table: TableName,
    private readonly store: Map<TableName, DbRow[]>,
    private readonly rows: DbRow[],
  ) {}

  order(
    column: string,
    opts: { ascending?: boolean; nullsFirst?: boolean } = {},
  ): this {
    this.sorts.push({
      column,
      ascending: opts.ascending ?? true,
      nullsFirst: opts.nullsFirst ?? false,
    });
    return this;
  }

  private resolve(): DbResult<DbRow> {
    const rows = this.store.get(this.table) ?? [];
    rows.push(...deepClone(this.rows));
    this.store.set(this.table, rows);

    let result = this.rows;
    if (this.sorts.length > 0) {
      result = applySorts([...this.rows], this.sorts);
    }
    return { data: deepClone(result[0] ?? null), error: null };
  }

  then<TResult1 = DbResult<DbRow>, TResult2 = never>(
    onFulfilled?:
      | ((value: DbResult<DbRow>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.resolve()).then(onFulfilled, onRejected);
  }

  [Symbol.toStringTag] = "FakeInsertSingleTerminal";
}

class FakeFromBuilder implements DbFromBuilder {
  constructor(
    private readonly table: TableName,
    private readonly store: Map<TableName, DbRow[]>,
  ) {}

  select(_columns?: string): DbQueryBuilder<DbRow[]> {
    return new FakeQueryBuilder<DbRow[]>(this.table, this.store);
  }

  insert(rows: DbRow | DbRow[]): DbInsertBuilder {
    const arr = Array.isArray(rows) ? rows : [rows];
    return new FakeInsertBuilder(this.table, this.store, arr);
  }

  update(values: DbRow): DbMutationBuilder {
    return new FakeMutationBuilder(this.table, this.store, "update", values);
  }

  delete(): DbMutationBuilder {
    return new FakeMutationBuilder(this.table, this.store, "delete");
  }
}

export type FakeDbSeed = Partial<Record<TableName, DbRow[]>>;

export class FakeDbClient implements DbClient {
  private readonly store: Map<TableName, DbRow[]>;

  /** Tables seeded by default — empty unless overridden by `seed`. */
  private static readonly DEFAULT_TABLES: readonly TableName[] = [
    "bookmarks",
    "workspaces",
    "tags",
    "bookmark_tags",
  ];

  constructor(seed: FakeDbSeed = {}) {
    this.store = new Map();
    for (const table of FakeDbClient.DEFAULT_TABLES) {
      const seeded = seed[table];
      this.store.set(table, seeded ? deepClone(seeded) : []);
    }
    // Allow callers to seed additional tables (test-first expansion).
    for (const [table, rows] of Object.entries(seed)) {
      if (!this.store.has(table)) {
        this.store.set(table, deepClone(rows as DbRow[]));
      }
    }
  }

  from(table: string): DbFromBuilder {
    if (!this.store.has(table)) {
      // Lazy-create unknown tables so the fake doesn't throw on a
      // new table before its seed is wired in.
      this.store.set(table, []);
    }
    return new FakeFromBuilder(table, this.store);
  }

  /**
   * RPC stub. Returns success with null data — no test currently
   * exercises RPC behaviour. Add stateful simulation test-first
   * when a repository test requires it.
   */
  rpc(
    _fn: string,
    _args?: Record<string, unknown>,
  ): PromiseLike<DbResult<unknown>> {
    return Promise.resolve({ data: null, error: null });
  }

  /**
   * Test-only inspection. Returns a deep-cloned, frozen snapshot of a
   * table's rows — assertions can't mutate the fake's internal state.
   *
   * Not part of {@link DbClient}; only available when the test holds
   * the concrete {@link FakeDbClient}.
   */
  peek(table: TableName): readonly DbRow[] {
    const rows = this.store.get(table) ?? [];
    return deepFreeze(deepClone(rows)) as readonly DbRow[];
  }
}
