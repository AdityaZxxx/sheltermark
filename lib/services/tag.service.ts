import "server-only";
import { and, eq } from "drizzle-orm";

import type { ActionResult } from "~/lib/action-result";
import type { DrizzleDb } from "~/lib/data/drizzle";
import type { Tag } from "~/lib/schemas/tag.schema";

import { upsertTag } from "~/lib/data/repositories/tag.repository";
import { bookmarkTags, bookmarks, tags } from "~/lib/data/schema";

export type TagServiceEntry = { id?: string; name?: string };

/**
 * SECURITY: Drizzle bypasses RLS — every operation here enforces ownership
 * explicitly because the service-role connection sees ALL rows. The bookmark
 * must belong to the user (RLS delete/insert policies used to enforce this),
 * and resolve-by-id verifies each tag belongs to the user.
 */
export async function resolveAndReplaceBookmarkTags(
  db: DrizzleDb,
  userId: string,
  bookmarkId: string,
  tagsInput: TagServiceEntry[],
): Promise<ActionResult<Tag[]>> {
  try {
    const [bookmark] = await db
      .select({ id: bookmarks.id })
      .from(bookmarks)
      .where(and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId)));
    if (!bookmark) return { success: false, error: "Bookmark not found" };

    const resolvedTags: Tag[] = [];

    for (const entry of tagsInput) {
      if (entry.id) {
        const [tag] = await db
          .select()
          .from(tags)
          .where(and(eq(tags.id, entry.id), eq(tags.userId, userId)));
        if (!tag) {
          return { success: false, error: "One or more tags not found" };
        }
        resolvedTags.push({
          id: tag.id,
          user_id: tag.userId,
          name: tag.name,
          created_at: tag.createdAt.toISOString(),
        });
      } else if (entry.name) {
        const upsertResult = await upsertTag(db, userId, entry.name);
        if (!upsertResult.success) return upsertResult;
        resolvedTags.push(upsertResult.data);
      }
    }

    await db
      .delete(bookmarkTags)
      .where(eq(bookmarkTags.bookmarkId, bookmarkId));

    if (resolvedTags.length > 0) {
      await db.insert(bookmarkTags).values(
        resolvedTags.map((tag) => ({
          bookmarkId,
          tagId: tag.id,
        })),
      );
    }

    return { success: true, data: resolvedTags };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Database error",
    };
  }
}
