import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod";

import type { BrokenStatus } from "~/lib/link-health/types";

/**
 * Drizzle schema — the source of truth for migration generation.
 *
 * Migrations: edit this file, run `bun run db:generate`, review the SQL,
 * then apply with `supabase db push` (see docs/setup.md). drizzle-kit only
 * models tables/columns/indexes/checks — RLS, triggers, and plpgsql functions
 * are hand-spliced into the generated files (see the audit_events migration).
 *
 * Not modeled: RLS policies (enforced per-connection by Supabase; see
 * lib/data/db.ts for the service-role caveat), triggers, functions,
 * and the FK from profiles.id to auth.users.
 */

const citext = customType<{ data: string }>({
  dataType() {
    return "citext";
  },
});

/**
 * timestamptz surfaced as an ISO-8601 string (`typeof row.created_at` is
 * `string`), so `$inferSelect` matches the wire contract without a mapping
 * layer. Drizzle's built-in `timestamp()` returns raw Postgres text
 * (`2026-04-16 13:18:53.940292+00`) in string mode — not ISO — and Date in
 * date mode; `fromDriver` normalizes to `new Date(...).toISOString()`.
 */
const isoTimestamptz = customType<{ data: string; driverData: string }>({
  dataType() {
    return "timestamp with time zone";
  },
  fromDriver(value) {
    // driver boundary: postgres-js hands the raw wire value for timestamptz;
    // parse it here so a contract violation fails loudly, not silently.
    const raw = z.string().parse(value);
    const iso = raw
      .replace(" ", "T")
      .replace(
        /([+-]\d{2})(?::?(\d{2}))?$/,
        (_m: string, hh: string, mm?: string) =>
          mm ? `${hh}:${mm}` : `${hh}:00`,
      );
    return new Date(iso).toISOString();
  },
});

export const profiles = pgTable(
  "profiles",
  {
    id: uuid().primaryKey().notNull(),
    username: text(),
    name: text(),
    avatar_url: text(),
    bio: text(),
    website_url: text(),
    github_url: text(),
    x_url: text(),
    is_public: boolean().notNull().default(false),
    created_at: isoTimestamptz()
      .notNull()
      .default(sql`timezone('utc'::text, now())`),
    updated_at: isoTimestamptz(),
    trash_cleanup_interval: integer().notNull().default(30),
  },
  (table) => [
    uniqueIndex("profiles_username_key").on(table.username),
    index("profiles_username_idx").on(table.username),
  ],
);

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid()
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    user_id: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: text().notNull(),
    is_public: boolean().default(false),
    is_default: boolean().notNull().default(false),
    created_at: isoTimestamptz()
      .notNull()
      .default(sql`timezone('utc'::text, now())`),
    updated_at: isoTimestamptz(),
    auto_check_broken: boolean().default(true),
    last_used_at: isoTimestamptz(),
    deleted_at: isoTimestamptz(),
  },
  (table) => [
    index("workspaces_user_id_idx").on(table.user_id),
    index("workspaces_one_default_per_user")
      .on(table.user_id)
      .where(sql`(is_default = true)`),
    index("idx_workspaces_user_default").on(table.user_id, table.is_default),
    index("idx_workspaces_user_public").on(table.user_id, table.is_public),
    index("idx_workspaces_user_last_used").on(
      table.user_id,
      table.last_used_at.desc(),
    ),
    index("idx_workspaces_deleted_at")
      .on(table.deleted_at)
      .where(sql`(deleted_at IS NOT NULL)`),
  ],
);

export const bookmarks = pgTable(
  "bookmarks",
  {
    id: uuid()
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    user_id: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    workspace_id: uuid().references(() => workspaces.id, {
      onDelete: "set null",
    }),
    url: text().notNull(),
    title: text(),
    favicon_url: text(),
    og_image_url: text(),
    created_at: isoTimestamptz()
      .notNull()
      .default(sql`timezone('utc'::text, now())`),
    updated_at: isoTimestamptz(),
    is_public: boolean().default(false),
    is_broken: boolean().default(false),
    last_checked_at: isoTimestamptz(),
    http_status: integer(),
    deleted_at: isoTimestamptz(),
    note: text(),
    broken_status: text().$type<BrokenStatus | null>(),
  },
  (table) => [
    index("bookmarks_user_id_idx").on(table.user_id),
    index("bookmarks_workspace_id_idx").on(table.workspace_id),
    // Live index direction is DESC (see supabase/migrations); .desc() keeps
    // the generated DDL in sync.
    index("bookmarks_created_at_idx").on(table.created_at.desc()),
    index("idx_bookmarks_deleted_at")
      .on(table.deleted_at)
      .where(sql`(deleted_at IS NOT NULL)`),
    index("idx_bookmarks_user_url").on(table.user_id, table.url),
    index("idx_bookmarks_user_workspace").on(table.user_id, table.workspace_id),
    uniqueIndex("bookmarks_workspace_url_unique")
      .on(table.workspace_id, table.url)
      .where(sql`(deleted_at IS NULL)`),
    index("bookmarks_is_broken_idx")
      .on(table.is_broken)
      .where(sql`(is_broken = true)`),
    index("bookmarks_last_checked_at_idx").on(table.last_checked_at),
    check(
      "bookmarks_broken_status_check",
      sql`broken_status IN ('alive', 'confirmed_broken', 'likely_broken', 'unknown')`,
    ),
  ],
);

export const feeds = pgTable(
  "feeds",
  {
    id: uuid()
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()`),
    user_id: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    workspace_id: uuid().references(() => workspaces.id, {
      onDelete: "set null",
    }),
    url: text().notNull(),
    title: text(),
    description: text(),
    site_url: text(),
    icon_url: text(),
    last_synced_at: isoTimestamptz(),
    created_at: isoTimestamptz().default(sql`now()`),
    updated_at: isoTimestamptz().default(sql`now()`),
  },
  (table) => [
    uniqueIndex("feeds_user_id_url_key").on(table.user_id, table.url),
  ],
);

export const feedEntries = pgTable(
  "feed_entries",
  {
    id: uuid()
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()`),
    feed_id: uuid()
      .notNull()
      .references(() => feeds.id, { onDelete: "cascade" }),
    title: text().notNull(),
    link: text().notNull(),
    content: text(),
    summary: text(),
    guid: text().notNull(),
    published: isoTimestamptz(),
    created_at: isoTimestamptz().default(sql`now()`),
  },
  (table) => [
    uniqueIndex("feed_entries_feed_id_guid_key").on(table.feed_id, table.guid),
  ],
);

export const tags = pgTable(
  "tags",
  {
    id: uuid()
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()`),
    user_id: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: citext().notNull(),
    created_at: isoTimestamptz()
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("idx_tags_user_id").on(table.user_id),
    index("idx_tags_user_name").on(table.user_id, table.name),
    uniqueIndex("tags_user_id_name_key").on(table.user_id, table.name),
  ],
);

export const bookmarkTags = pgTable(
  "bookmark_tags",
  {
    bookmark_id: uuid()
      .notNull()
      .references(() => bookmarks.id, { onDelete: "cascade" }),
    tag_id: uuid()
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    created_at: isoTimestamptz()
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    primaryKey({ columns: [table.bookmark_id, table.tag_id] }),
    index("idx_bookmark_tags_bookmark_id").on(table.bookmark_id),
    index("idx_bookmark_tags_tag_id").on(table.tag_id),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid()
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()`),
    actor_type: text().notNull(),
    actor_id: text().notNull(),
    action: text().notNull(),
    resource_type: text().notNull(),
    resource_id: uuid(),
    reason: text().notNull(),
    metadata: jsonb().notNull().default({}),
    created_at: isoTimestamptz()
      .notNull()
      .default(sql`timezone('utc'::text, now())`),
  },
  (table) => [
    index("idx_audit_events_created_at").on(table.created_at.desc()),
    index("idx_audit_events_action").on(table.action),
    check(
      "audit_events_actor_type_check",
      sql`actor_type IN ('cron', 'developer', 'system')`,
    ),
    // Structural content rules mirrored from lib/audit.ts: identity fields
    // match a machine-identifier grammar (no spaces, `/`, `@`) so URLs,
    // emails, and prose are impossible here. See docs/policies/data-access.md.
    check(
      "audit_events_actor_id_check",
      sql`actor_id ~ '^[A-Za-z][A-Za-z0-9_:#.-]{0,199}$'`,
    ),
    check(
      "audit_events_action_check",
      sql`char_length(action) <= 100 AND action ~ '^[a-z0-9]+([._][a-z0-9]+)*$'`,
    ),
    check(
      "audit_events_resource_type_check",
      sql`resource_type ~ '^[a-z][a-z0-9_.-]{0,99}$'`,
    ),
    check(
      "audit_events_reason_check",
      sql`char_length(reason) >= 3 AND char_length(reason) <= 500`,
    ),
    // helper function lives in the migration file (drizzle-kit can't model it)
    check(
      "audit_events_metadata_content_check",
      sql`audit_metadata_is_content_free(metadata)`,
    ),
  ],
);

// Server-side extracted content cache for the inline preview (ADR-0007).
// Global (not per-user): a sanitized article is identical for every reader, so
// the row is keyed by the normalized URL. Service-role only — never exposed to
// anon/authenticated roles (no RLS policies).
export const bookmarkExtractions = pgTable(
  "bookmark_extractions",
  {
    id: uuid()
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()`),
    url_hash: text().notNull(),
    kind: text().notNull().default("extract"),
    url: text().notNull(),
    status: text().notNull(),
    title: text(),
    byline: text(),
    site_name: text(),
    excerpt: text(),
    html: text(),
    length: integer(),
    fetched_at: isoTimestamptz()
      .notNull()
      .default(sql`now()`),
    created_at: isoTimestamptz()
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    uniqueIndex("bookmark_extractions_kind_url_hash_key").on(
      table.kind,
      table.url_hash,
    ),
    index("idx_bookmark_extractions_fetched_at").on(table.fetched_at),
    check("bookmark_extractions_status_check", sql`status IN ('ok', 'empty')`),
    check("bookmark_extractions_kind_check", sql`kind IN ('extract', 'proxy')`),
  ],
);
