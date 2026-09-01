import "server-only";
import { and, count, eq, inArray, isNull } from "drizzle-orm";

import type { DrizzleDb } from "~/lib/data/db";
import type {
  DeleteTagInput,
  GetBookmarkTagsInput,
  RenameTagInput,
  Tag,
  TagWithCount,
} from "~/lib/schemas/tag.schema";

import { dbError, invalidData, type ActionResult } from "~/lib/action-result";
import { bookmarkTags, bookmarks, tags } from "~/lib/data/schema";
import {
  deleteTagSchema,
  getBookmarkTagsSchema,
  renameTagSchema,
} from "~/lib/schemas/tag.schema";

function toTag(row: typeof tags.$inferSelect): Tag {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    created_at: row.created_at,
  };
}

/**
 * SECURITY: Drizzle connects with the service-role credential and BYPASSES
 * ROW LEVEL SECURITY. Every query in this file enforces `user_id` ownership
 * explicitly; ownership checks that RLS policies used to provide are now
 * expressed here.
 */
export async function getUserTags(
  db: DrizzleDb,
  userId: string,
): Promise<ActionResult<Tag[]>> {
  try {
    const rows = await db
      .select()
      .from(tags)
      .where(eq(tags.user_id, userId))
      .orderBy(tags.name);
    return { success: true, data: rows.map(toTag) };
  } catch (err) {
    return dbError("Tag", err);
  }
}

export async function getWorkspaceTagsWithCount(
  db: DrizzleDb,
  userId: string,
  workspaceId: string,
): Promise<ActionResult<TagWithCount[]>> {
  try {
    const rows = await db
      .select({
        tagId: tags.id,
        tag: tags,
        count: count(bookmarkTags.bookmark_id),
      })
      .from(bookmarkTags)
      .innerJoin(bookmarks, eq(bookmarks.id, bookmarkTags.bookmark_id))
      .innerJoin(tags, eq(tags.id, bookmarkTags.tag_id))
      .where(
        and(
          eq(bookmarks.workspace_id, workspaceId),
          eq(bookmarks.user_id, userId),
          isNull(bookmarks.deleted_at),
          eq(tags.user_id, userId),
        ),
      )
      .groupBy(tags.id);

    const result: TagWithCount[] = rows
      .map((row) => ({ ...toTag(row.tag), count: row.count }))
      .toSorted((a, b) => a.name.localeCompare(b.name));

    return { success: true, data: result };
  } catch (err) {
    return dbError("Tag", err);
  }
}

export async function getTagsWithCount(
  db: DrizzleDb,
  userId: string,
): Promise<ActionResult<TagWithCount[]>> {
  try {
    const rows = await db
      .select({
        id: tags.id,
        name: tags.name,
        created_at: tags.created_at,
        count: count(bookmarkTags.tag_id),
      })
      .from(tags)
      .leftJoin(bookmarkTags, eq(bookmarkTags.tag_id, tags.id))
      .where(eq(tags.user_id, userId))
      .groupBy(tags.id)
      .orderBy(tags.name);

    const data: TagWithCount[] = rows.map((row) => ({
      id: row.id,
      user_id: userId,
      name: row.name,
      created_at: row.created_at,
      count: row.count,
    }));
    return { success: true, data };
  } catch (err) {
    return dbError("Tag", err);
  }
}

export async function getBookmarkTags(
  db: DrizzleDb,
  userId: string,
  input: GetBookmarkTagsInput,
): Promise<ActionResult<Tag[]>> {
  const validated = getBookmarkTagsSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: invalidData("Tag", validated.error) };
  }

  try {
    const rows = await db
      .select({ tag: tags })
      .from(bookmarkTags)
      .innerJoin(tags, eq(tags.id, bookmarkTags.tag_id))
      .where(
        and(
          eq(bookmarkTags.bookmark_id, validated.data.bookmarkId),
          // Tag ownership is enforced here (RLS "view bookmark_tags" allowed
          // any link row whose bookmark belonged to the user; tags join
          // filtered by the same policy).
          eq(tags.user_id, userId),
        ),
      );
    return { success: true, data: rows.map((r) => toTag(r.tag)) };
  } catch (err) {
    return dbError("Tag", err);
  }
}

export async function upsertTag(
  db: DrizzleDb,
  userId: string,
  name: string,
): Promise<ActionResult<Tag>> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { success: false, error: "Tag name cannot be empty" };
  }

  try {
    const [row] = await db
      .insert(tags)
      .values({ user_id: userId, name: trimmed })
      .onConflictDoUpdate({
        target: [tags.user_id, tags.name],
        set: { name: trimmed },
      })
      .returning();
    if (!row) {
      return { success: false, error: "Failed to upsert tag" };
    }
    return { success: true, data: toTag(row) };
  } catch (err) {
    return dbError("Tag", err);
  }
}

/**
 * Bulk variant of upsertTag: minimal round trips for any number of names.
 * Names are deduped case-insensitively (citext collation) before the insert;
 * returned rows have no guaranteed order — callers key by name/id, not
 * position.
 */
export async function upsertTags(
  db: DrizzleDb,
  userId: string,
  names: string[],
): Promise<ActionResult<Tag[]>> {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    unique.push(name);
  }
  if (unique.length === 0) return { success: true, data: [] };

  try {
    // Two round trips for N names (vs N): insert the missing ones, then
    // select all by name — onConflictDoNothing's RETURNING only yields the
    // newly created rows, so the select is what resolves every name to a row.
    await db
      .insert(tags)
      .values(unique.map((name) => ({ user_id: userId, name })))
      .onConflictDoNothing({ target: [tags.user_id, tags.name] });
    const rows = await db
      .select()
      .from(tags)
      .where(and(eq(tags.user_id, userId), inArray(tags.name, unique)));
    return { success: true, data: rows.map(toTag) };
  } catch (err) {
    return dbError("Tag", err);
  }
}

export async function renameTag(
  db: DrizzleDb,
  userId: string,
  input: RenameTagInput,
): Promise<ActionResult<Tag>> {
  const validated = renameTagSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: invalidData("Tag", validated.error) };
  }

  const { tagId, name } = validated.data;

  try {
    const [row] = await db
      .update(tags)
      .set({ name })
      .where(and(eq(tags.id, tagId), eq(tags.user_id, userId)))
      .returning();
    if (!row) {
      return { success: false, error: "Tag not found" };
    }
    return { success: true, data: toTag(row) };
  } catch (err) {
    return dbError("Tag", err);
  }
}

export async function deleteTag(
  db: DrizzleDb,
  userId: string,
  input: DeleteTagInput,
): Promise<ActionResult<null>> {
  const validated = deleteTagSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: invalidData("Tag", validated.error) };
  }

  try {
    await db
      .delete(tags)
      .where(and(eq(tags.id, validated.data.tagId), eq(tags.user_id, userId)));
  } catch (err) {
    return dbError("Tag", err);
  }
  return { success: true, data: null };
}
