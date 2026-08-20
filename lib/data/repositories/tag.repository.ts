import "server-only";
import { and, count, eq, inArray, isNull } from "drizzle-orm";

import type { ActionResult } from "~/lib/action-result";
import type { DrizzleDb } from "~/lib/data/db";
import type {
  DeleteTagInput,
  GetBookmarkTagsInput,
  RenameTagInput,
  Tag,
  TagWithCount,
} from "~/lib/schemas/tag.schema";

import { bookmarkTags, bookmarks, tags } from "~/lib/data/schema";
import {
  deleteTagSchema,
  getBookmarkTagsSchema,
  renameTagSchema,
} from "~/lib/schemas/tag.schema";

function toTag(row: typeof tags.$inferSelect): Tag {
  return {
    id: row.id,
    user_id: row.userId,
    name: row.name,
    created_at: row.createdAt.toISOString(),
  };
}

function dbError(cause: unknown): ActionResult<never> {
  return {
    success: false,
    error: cause instanceof Error ? cause.message : "Database error",
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
      .where(eq(tags.userId, userId))
      .orderBy(tags.name);
    return { success: true, data: rows.map(toTag) };
  } catch (err) {
    return dbError(err);
  }
}

export async function getWorkspaceTagsWithCount(
  db: DrizzleDb,
  userId: string,
  workspaceId: string,
): Promise<ActionResult<TagWithCount[]>> {
  try {
    const rows = await db
      .select({ id: bookmarks.id })
      .from(bookmarks)
      .where(
        and(
          eq(bookmarks.workspaceId, workspaceId),
          eq(bookmarks.userId, userId),
          isNull(bookmarks.deletedAt),
        ),
      );
    const bookmarkIds = rows.map((b) => b.id);
    if (bookmarkIds.length === 0) {
      return { success: true, data: [] };
    }

    const links = await db
      .select({
        tagId: bookmarkTags.tagId,
        tag: tags,
      })
      .from(bookmarkTags)
      .innerJoin(tags, eq(tags.id, bookmarkTags.tagId))
      .where(
        and(
          inArray(bookmarkTags.bookmarkId, bookmarkIds),
          eq(tags.userId, userId),
        ),
      );

    const countByTag = new Map<string, number>();
    const tagInfoMap = new Map<string, Tag>();
    for (const link of links) {
      tagInfoMap.set(link.tagId, toTag(link.tag));
      countByTag.set(link.tagId, (countByTag.get(link.tagId) ?? 0) + 1);
    }

    const result: TagWithCount[] = Array.from(tagInfoMap.entries())
      .map(([id, info]) => ({
        ...info,
        count: countByTag.get(id) ?? 0,
      }))
      .toSorted((a, b) => a.name.localeCompare(b.name));

    return { success: true, data: result };
  } catch (err) {
    return dbError(err);
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
        createdAt: tags.createdAt,
        count: count(bookmarkTags.tagId),
      })
      .from(tags)
      .leftJoin(bookmarkTags, eq(bookmarkTags.tagId, tags.id))
      .where(eq(tags.userId, userId))
      .groupBy(tags.id)
      .orderBy(tags.name);

    const data: TagWithCount[] = rows.map((row) => ({
      id: row.id,
      user_id: userId,
      name: row.name,
      created_at: row.createdAt.toISOString(),
      count: row.count,
    }));
    return { success: true, data };
  } catch (err) {
    return dbError(err);
  }
}

export async function getBookmarkTags(
  db: DrizzleDb,
  userId: string,
  input: GetBookmarkTagsInput,
): Promise<ActionResult<Tag[]>> {
  const validated = getBookmarkTagsSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }

  try {
    const rows = await db
      .select({ tag: tags })
      .from(bookmarkTags)
      .innerJoin(tags, eq(tags.id, bookmarkTags.tagId))
      .where(
        and(
          eq(bookmarkTags.bookmarkId, validated.data.bookmarkId),
          // Tag ownership is enforced here (RLS "view bookmark_tags" allowed
          // any link row whose bookmark belonged to the user; tags join
          // filtered by the same policy).
          eq(tags.userId, userId),
        ),
      );
    return { success: true, data: rows.map((r) => toTag(r.tag)) };
  } catch (err) {
    return dbError(err);
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
      .values({ userId, name: trimmed })
      .onConflictDoUpdate({
        target: [tags.userId, tags.name],
        set: { name: trimmed },
      })
      .returning();
    if (!row) {
      return { success: false, error: "Failed to upsert tag" };
    }
    return { success: true, data: toTag(row) };
  } catch (err) {
    return dbError(err);
  }
}

export async function renameTag(
  db: DrizzleDb,
  userId: string,
  input: RenameTagInput,
): Promise<ActionResult<Tag>> {
  const validated = renameTagSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }

  const { tagId, name } = validated.data;

  try {
    const [row] = await db
      .update(tags)
      .set({ name })
      .where(and(eq(tags.id, tagId), eq(tags.userId, userId)))
      .returning();
    if (!row) {
      return { success: false, error: "Tag not found" };
    }
    return { success: true, data: toTag(row) };
  } catch (err) {
    return dbError(err);
  }
}

export async function deleteTag(
  db: DrizzleDb,
  userId: string,
  input: DeleteTagInput,
): Promise<ActionResult<null>> {
  const validated = deleteTagSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }

  try {
    await db
      .delete(tags)
      .where(and(eq(tags.id, validated.data.tagId), eq(tags.userId, userId)));
  } catch (err) {
    return dbError(err);
  }
  return { success: true, data: null };
}
