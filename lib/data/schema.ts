import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { BrokenStatus } from "~/lib/link-health/types";

/**
 * Drizzle schema — derived model of the public schema.
 *
 * The canonical migration history lives in supabase/migrations/. This file
 * mirrors it for typed query building only; drizzle-kit migrations are NOT
 * used here. Keep in sync manually (verify via drizzle-kit generate).
 *
 * Not modeled: RLS policies (enforced per-connection by Supabase; see
 * lib/data/drizzle.ts for the service-role caveat), triggers, functions,
 * and the FK from profiles.id to auth.users.
 */

const citext = customType<{ data: string }>({
  dataType() {
    return "citext";
  },
});

export const profiles = pgTable(
  "profiles",
  {
    id: uuid().primaryKey().notNull(),
    username: text(),
    name: text(),
    avatarUrl: text("avatar_url"),
    bio: text(),
    websiteUrl: text("website_url"),
    githubUrl: text("github_url"),
    xUrl: text("x_url"),
    isPublic: boolean("is_public").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`timezone('utc'::text, now())`),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    trashCleanupInterval: integer("trash_cleanup_interval")
      .notNull()
      .default(30),
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
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: text().notNull(),
    isPublic: boolean("is_public").default(false),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`timezone('utc'::text, now())`),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    autoCheckBroken: boolean("auto_check_broken").default(true),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("workspaces_user_id_idx").on(table.userId),
    index("workspaces_one_default_per_user")
      .on(table.userId)
      .where(sql`(is_default = true)`),
    index("idx_workspaces_user_default").on(table.userId, table.isDefault),
    index("idx_workspaces_user_public").on(table.userId, table.isPublic),
    index("idx_workspaces_deleted_at")
      .on(table.deletedAt)
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
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, {
      onDelete: "set null",
    }),
    url: text().notNull(),
    title: text(),
    faviconUrl: text("favicon_url"),
    ogImageUrl: text("og_image_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`timezone('utc'::text, now())`),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    isPublic: boolean("is_public").default(false),
    isBroken: boolean("is_broken").default(false),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    httpStatus: integer("http_status"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    note: text(),
    brokenStatus: text("broken_status").$type<BrokenStatus | null>(),
  },
  (table) => [
    index("bookmarks_user_id_idx").on(table.userId),
    index("bookmarks_workspace_id_idx").on(table.workspaceId),
    // Live index direction is DESC (see supabase/migrations); .desc() keeps
    // the generated DDL in sync.
    index("bookmarks_created_at_idx").on(table.createdAt.desc()),
    index("idx_bookmarks_deleted_at")
      .on(table.deletedAt)
      .where(sql`(deleted_at IS NOT NULL)`),
    index("idx_bookmarks_user_url").on(table.userId, table.url),
    index("idx_bookmarks_user_workspace").on(table.userId, table.workspaceId),
    uniqueIndex("bookmarks_workspace_url_unique")
      .on(table.workspaceId, table.url)
      .where(sql`(deleted_at IS NULL)`),
    index("bookmarks_is_broken_idx")
      .on(table.isBroken)
      .where(sql`(is_broken = true)`),
    index("bookmarks_last_checked_at_idx").on(table.lastCheckedAt),
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
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, {
      onDelete: "set null",
    }),
    url: text().notNull(),
    title: text(),
    description: text(),
    siteUrl: text("site_url"),
    iconUrl: text("icon_url"),
    lastSyncedAt: timestamp("last_synced_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    }).defaultNow(),
  },
  (table) => [uniqueIndex("feeds_user_id_url_key").on(table.userId, table.url)],
);

export const feedEntries = pgTable(
  "feed_entries",
  {
    id: uuid()
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()`),
    feedId: uuid("feed_id")
      .notNull()
      .references(() => feeds.id, { onDelete: "cascade" }),
    title: text().notNull(),
    link: text().notNull(),
    content: text(),
    summary: text(),
    guid: text().notNull(),
    published: timestamp("published", { withTimezone: true }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow(),
  },
  (table) => [
    uniqueIndex("feed_entries_feed_id_guid_key").on(table.feedId, table.guid),
  ],
);

export const tags = pgTable(
  "tags",
  {
    id: uuid()
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: citext().notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_tags_user_id").on(table.userId),
    index("idx_tags_user_name").on(table.userId, table.name),
    uniqueIndex("tags_user_id_name_key").on(table.userId, table.name),
  ],
);

export const bookmarkTags = pgTable(
  "bookmark_tags",
  {
    bookmarkId: uuid("bookmark_id")
      .notNull()
      .references(() => bookmarks.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.bookmarkId, table.tagId] }),
    index("idx_bookmark_tags_bookmark_id").on(table.bookmarkId),
    index("idx_bookmark_tags_tag_id").on(table.tagId),
  ],
);
