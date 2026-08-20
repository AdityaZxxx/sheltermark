import "server-only";
import type { z } from "zod";

import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import type { ActionResult } from "~/lib/action-result";
import type { DrizzleDb } from "~/lib/data/db";
import type { Metadata } from "~/lib/metadata/types";
import type { Bookmark } from "~/lib/schemas/bookmark.schema";
import type { exportOptionsSchema } from "~/lib/schemas/profile.schema";
import type { Tag } from "~/lib/schemas/tag.schema";

import { generateBookmarkTitle } from "~/lib/ai/generate-title";
import { checkRateLimit } from "~/lib/ai/rate-limit";
import { upsertTag } from "~/lib/data/repositories/tag.repository";
import { bookmarkTags, bookmarks, workspaces } from "~/lib/data/schema";
import { fetchMetadata } from "~/lib/metadata/pipeline";
import {
  type BookmarkDeleteInput,
  type BookmarkEditInput,
  type BookmarkMoveInput,
  type BookmarkRefetchMetadataInput,
  type BookmarkRenameInput,
  type BookmarkUpdateNoteInput,
  bookmarkDeleteSchema,
  bookmarkEditSchema,
  bookmarkMoveSchema,
  bookmarkRefetchMetadataSchema,
  bookmarkRenameSchema,
  bookmarkUpdateNoteSchema,
  type GenerateAiTitleInput,
  generateAiTitleSchema,
} from "~/lib/schemas/bookmark.schema";
import { resolveAndReplaceBookmarkTags } from "~/lib/services/tag.service";
import { normalizeUrl } from "~/lib/utils";

type BookmarkRow = typeof bookmarks.$inferSelect;

/** Metadata lookup seam so tests can inject a deterministic fetcher. */
export type MetadataFetcher = (url: string) => Promise<Metadata>;

type InsertBookmarkParams = {
  url: string;
  workspaceId?: string | null;
  clientTitle?: string | null;
  /**
   * Tag *names* to create-and-link atomically at insert time. Empty/absent is
   * a no-op so fast flows (action shortcut, context menu, X capture) behave
   * byte-identically to before.
   */
  tagNames?: string[];
};

type InsertBookmarkResult =
  | { success: true; data: Bookmark; tags: Tag[] }
  | { success: false; duplicate: true }
  | { success: false; duplicate?: false; error: string };

function toBookmark(row: BookmarkRow): Bookmark {
  return {
    id: row.id,
    user_id: row.userId,
    workspace_id: row.workspaceId,
    url: row.url,
    title: row.title ?? "",
    favicon_url: row.faviconUrl,
    og_image_url: row.ogImageUrl,
    is_public: row.isPublic ?? false,
    is_broken: row.isBroken ?? false,
    broken_status: row.brokenStatus ?? "alive",
    http_status: row.httpStatus,
    last_checked_at: row.lastCheckedAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt?.toISOString() ?? null,
    deleted_at: row.deletedAt?.toISOString() ?? null,
    note: row.note,
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
 * ROW LEVEL SECURITY. Every query here enforces `user_id` ownership
 * explicitly; the old RLS SELECT policy for public bookmarks read a
 * workspace's `is_public` — getPublicProfile handles that read instead.
 */
export async function insertBookmark(
  db: DrizzleDb,
  userId: string,
  { url, workspaceId, clientTitle, tagNames }: InsertBookmarkParams,
  fetchMetadataFn: MetadataFetcher = fetchMetadata,
): Promise<InsertBookmarkResult> {
  const normalizedUrl = normalizeUrl(url);

  const existingPromise = db
    .select({ id: bookmarks.id })
    .from(bookmarks)
    .where(
      and(
        eq(bookmarks.userId, userId),
        eq(bookmarks.url, normalizedUrl),
        isNull(bookmarks.deletedAt),
        workspaceId
          ? eq(bookmarks.workspaceId, workspaceId)
          : isNull(bookmarks.workspaceId),
      ),
    )
    .limit(1);

  const [existing, metadata] = await Promise.all([
    existingPromise,
    fetchMetadataFn(url),
  ]);

  if (existing.length > 0) {
    return { success: false, duplicate: true };
  }

  // Explicit user-supplied title wins over fetched metadata; both fall back
  // to "Untitled". (Previously metadata always won, which silently ignored
  // any title the client sent.)
  const title =
    clientTitle && clientTitle.trim().length > 0
      ? clientTitle
      : (metadata?.title ?? "Untitled");

  let row: BookmarkRow;
  try {
    const inserted = await db
      .insert(bookmarks)
      .values({
        userId,
        url: normalizedUrl,
        workspaceId: workspaceId ?? null,
        title,
        faviconUrl: metadata?.favicon_url ?? null,
        ogImageUrl: metadata?.og_image_url ?? null,
      })
      .returning();
    const first = inserted[0];
    if (!first) return { success: false, error: "Insert returned no row" };
    row = first;
  } catch (cause) {
    return {
      success: false,
      error: cause instanceof Error ? cause.message : "Database error",
    };
  }

  const bookmark = toBookmark(row);

  // Resolve-or-create each tag by name then link. Post-insert failures leave
  // the bookmark saved but return an error so the caller never reports a
  // broken partial state as success.
  if (tagNames && tagNames.length > 0) {
    const deduped = dedupeTagNames(tagNames);
    const resolved: Tag[] = [];
    for (const name of deduped) {
      const upserted = await upsertTag(db, userId, name);
      if (!upserted.success) return { success: false, error: upserted.error };
      resolved.push(upserted.data);
    }
    if (resolved.length > 0) {
      try {
        await db.insert(bookmarkTags).values(
          resolved.map((tag) => ({
            bookmarkId: bookmark.id,
            tagId: tag.id,
          })),
        );
      } catch (cause) {
        return {
          success: false,
          error: cause instanceof Error ? cause.message : "Database error",
        };
      }
    }
    return { success: true, data: bookmark, tags: resolved };
  }

  return { success: true, data: bookmark, tags: [] };
}

/** Case-insensitive, whitespace-trimmed dedup matching the citext collation. */
function dedupeTagNames(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export async function getBookmarks(
  db: DrizzleDb,
  userId: string,
  workspaceId?: string,
): Promise<ActionResult<Bookmark[]>> {
  try {
    const rows = await db
      .select()
      .from(bookmarks)
      .where(
        and(
          eq(bookmarks.userId, userId),
          isNull(bookmarks.deletedAt),
          workspaceId ? eq(bookmarks.workspaceId, workspaceId) : undefined,
        ),
      )
      .orderBy(desc(bookmarks.createdAt));
    return { success: true, data: rows.map(toBookmark) };
  } catch (cause) {
    return dbError(cause);
  }
}

export async function deleteBookmarks(
  db: DrizzleDb,
  userId: string,
  { ids }: BookmarkDeleteInput,
): Promise<ActionResult<null>> {
  const validated = bookmarkDeleteSchema.safeParse({ ids });
  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }

  const now = new Date();
  try {
    await db
      .update(bookmarks)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          inArray(bookmarks.id, validated.data.ids),
          eq(bookmarks.userId, userId),
        ),
      );
  } catch (cause) {
    return dbError(cause);
  }
  return { success: true, data: null };
}

export async function getTrashedBookmarks(
  db: DrizzleDb,
  userId: string,
): Promise<ActionResult<Bookmark[]>> {
  try {
    const rows = await db
      .select()
      .from(bookmarks)
      .where(and(eq(bookmarks.userId, userId), isNotNull(bookmarks.deletedAt)))
      .orderBy(desc(bookmarks.deletedAt));
    return { success: true, data: rows.map(toBookmark) };
  } catch (cause) {
    return dbError(cause);
  }
}

export type BatchBookmarkInput = {
  url: string;
  title: string;
  favicon_url?: string | null;
  og_image_url?: string | null;
};

export async function batchInsertBookmarks(
  db: DrizzleDb,
  userId: string,
  workspaceId: string | null,
  bookmarksToInsert: BatchBookmarkInput[],
  options?: { duplicateStrategy?: "skip" | "replace" },
): Promise<
  ActionResult<{ imported: number; skipped: number; errors: string[] }>
> {
  const errors: string[] = [];
  const toInsert: BatchBookmarkInput[] = [];
  const replaceUrls: string[] = [];
  const strategy = options?.duplicateStrategy ?? "skip";

  const existingRows = await db
    .select({ url: bookmarks.url })
    .from(bookmarks)
    .where(
      and(
        eq(bookmarks.userId, userId),
        isNull(bookmarks.deletedAt),
        workspaceId
          ? eq(bookmarks.workspaceId, workspaceId)
          : isNull(bookmarks.workspaceId),
      ),
    );
  const existingUrls = new Set(existingRows.map((b) => b.url));

  for (const bookmark of bookmarksToInsert) {
    try {
      const parsed = new URL(bookmark.url);
      if (!(parsed instanceof URL)) {
        errors.push(`Invalid URL: ${bookmark.url}`);
        continue;
      }
    } catch {
      errors.push(`Invalid URL: ${bookmark.url}`);
      continue;
    }

    const normalizedUrl = normalizeUrl(bookmark.url);

    if (existingUrls.has(normalizedUrl)) {
      if (strategy === "skip") {
        continue;
      }
      replaceUrls.push(normalizedUrl);
    }

    toInsert.push({
      url: normalizedUrl,
      title: bookmark.title || bookmark.url,
      favicon_url: bookmark.favicon_url || null,
      og_image_url: bookmark.og_image_url || null,
    });
  }

  if (replaceUrls.length > 0) {
    try {
      await db
        .delete(bookmarks)
        .where(
          and(
            eq(bookmarks.userId, userId),
            inArray(bookmarks.url, replaceUrls),
            workspaceId
              ? eq(bookmarks.workspaceId, workspaceId)
              : isNull(bookmarks.workspaceId),
          ),
        );
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Delete failed";
      errors.push(`Replace deletions: ${message}`);
    }
  }

  if (toInsert.length === 0) {
    return {
      success: true,
      data: { imported: 0, skipped: bookmarksToInsert.length, errors },
    };
  }

  const batchSize = 100;
  const batches: { batch: BatchBookmarkInput[]; index: number }[] = [];
  for (let i = 0; i < toInsert.length; i += batchSize) {
    batches.push({
      batch: toInsert.slice(i, i + batchSize),
      index: Math.floor(i / batchSize),
    });
  }

  const batchResults = await Promise.allSettled(
    batches.map(({ batch }) =>
      db.insert(bookmarks).values(
        batch.map((bm) => ({
          userId,
          workspaceId,
          url: bm.url,
          title: bm.title,
          faviconUrl: bm.favicon_url || null,
          ogImageUrl: bm.og_image_url || null,
        })),
      ),
    ),
  );

  let imported = 0;
  for (let i = 0; i < batchResults.length; i++) {
    const result = batchResults[i];
    if (!result) continue;
    const batchLabel = i + 1;
    if (result.status === "fulfilled") {
      imported += batches[i]?.batch.length ?? 0;
    } else {
      errors.push(
        `Batch ${batchLabel}: ${result.reason?.message ?? "Insert failed"}`,
      );
    }
  }

  return {
    success: true,
    data: {
      imported,
      skipped: bookmarksToInsert.length - imported,
      errors,
    },
  };
}

export async function permanentDeleteBookmarks(
  db: DrizzleDb,
  userId: string,
  { ids }: BookmarkDeleteInput,
): Promise<ActionResult<null>> {
  const validated = bookmarkDeleteSchema.safeParse({ ids });
  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }

  try {
    await db
      .delete(bookmarks)
      .where(
        and(
          inArray(bookmarks.id, validated.data.ids),
          eq(bookmarks.userId, userId),
        ),
      );
  } catch (cause) {
    return dbError(cause);
  }
  return { success: true, data: null };
}

export async function moveBookmarks(
  db: DrizzleDb,
  userId: string,
  { ids, targetWorkspaceId }: BookmarkMoveInput,
): Promise<ActionResult<{ movedCount: number; skippedCount: number }>> {
  const validated = bookmarkMoveSchema.safeParse({ ids, targetWorkspaceId });
  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }

  const sourceIds = validated.data.ids;
  const targetId =
    !validated.data.targetWorkspaceId ||
    validated.data.targetWorkspaceId === "null"
      ? null
      : validated.data.targetWorkspaceId;

  try {
    const sourceBookmarks = await db
      .select({ id: bookmarks.id, url: bookmarks.url })
      .from(bookmarks)
      .where(
        and(inArray(bookmarks.id, sourceIds), eq(bookmarks.userId, userId)),
      );

    if (sourceBookmarks.length === 0) {
      return { success: false, error: "No bookmarks found to move" };
    }

    const sourceUrls = sourceBookmarks.map((b) => b.url);

    const existingInTarget = await db
      .select({ url: bookmarks.url })
      .from(bookmarks)
      .where(
        and(
          eq(bookmarks.userId, userId),
          isNull(bookmarks.deletedAt),
          inArray(bookmarks.url, sourceUrls),
          targetId
            ? eq(bookmarks.workspaceId, targetId)
            : isNull(bookmarks.workspaceId),
        ),
      );

    const existingUrls = new Set(existingInTarget.map((b) => b.url));

    const toMoveIds: string[] = [];
    let skippedCount = 0;
    for (const bookmark of sourceBookmarks) {
      if (existingUrls.has(bookmark.url)) {
        skippedCount++;
      } else {
        toMoveIds.push(bookmark.id);
      }
    }

    if (toMoveIds.length > 0) {
      await db
        .update(bookmarks)
        .set({ workspaceId: targetId, updatedAt: new Date() })
        .where(
          and(inArray(bookmarks.id, toMoveIds), eq(bookmarks.userId, userId)),
        );
    }

    return {
      success: true,
      data: {
        movedCount: toMoveIds.length,
        skippedCount,
      },
    };
  } catch (cause) {
    return dbError(cause);
  }
}

export async function renameBookmark(
  db: DrizzleDb,
  userId: string,
  { id, title }: BookmarkRenameInput,
): Promise<ActionResult<null>> {
  const validated = bookmarkRenameSchema.safeParse({ id, title });
  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }

  try {
    await db
      .update(bookmarks)
      .set({ title: validated.data.title, updatedAt: new Date() })
      .where(
        and(eq(bookmarks.id, validated.data.id), eq(bookmarks.userId, userId)),
      );
  } catch (cause) {
    return dbError(cause);
  }
  return { success: true, data: null };
}

export async function updateBookmarkNote(
  db: DrizzleDb,
  userId: string,
  { id, note }: BookmarkUpdateNoteInput,
): Promise<ActionResult<null>> {
  const validated = bookmarkUpdateNoteSchema.safeParse({ id, note });
  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }

  try {
    await db
      .update(bookmarks)
      .set({ note: validated.data.note, updatedAt: new Date() })
      .where(
        and(eq(bookmarks.id, validated.data.id), eq(bookmarks.userId, userId)),
      );
  } catch (cause) {
    return dbError(cause);
  }
  return { success: true, data: null };
}

export async function updateBookmarkFields(
  db: DrizzleDb,
  userId: string,
  input: BookmarkEditInput,
): Promise<ActionResult<Tag[]>> {
  const validated = bookmarkEditSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }

  const { id, title, note, tags } = validated.data;

  try {
    await db
      .update(bookmarks)
      .set({ title, note, updatedAt: new Date() })
      .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)));
  } catch (cause) {
    return dbError(cause);
  }

  const tagResult = await resolveAndReplaceBookmarkTags(db, userId, id, tags);
  if (!tagResult.success) return tagResult;

  return { success: true, data: tagResult.data };
}

export async function refetchMetadata(
  db: DrizzleDb,
  userId: string,
  id: BookmarkRefetchMetadataInput,
): Promise<ActionResult<null>> {
  const validated = bookmarkRefetchMetadataSchema.safeParse(id);
  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }

  let bookmarkUrl: string;
  try {
    const [row] = await db
      .select({ url: bookmarks.url })
      .from(bookmarks)
      .where(
        and(eq(bookmarks.id, validated.data.id), eq(bookmarks.userId, userId)),
      )
      .limit(1);
    if (!row) {
      return { success: false, error: "Bookmark not found" };
    }
    bookmarkUrl = row.url;
  } catch (cause) {
    return dbError(cause);
  }

  const metadata = await fetchMetadata(bookmarkUrl);

  try {
    await db
      .update(bookmarks)
      .set({
        faviconUrl: metadata?.favicon_url ?? null,
        ogImageUrl: metadata?.og_image_url ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(eq(bookmarks.id, validated.data.id), eq(bookmarks.userId, userId)),
      );
  } catch (cause) {
    return dbError(cause);
  }
  return { success: true, data: null };
}

export async function generateAiTitleRepo(
  db: DrizzleDb,
  userId: string,
  input: GenerateAiTitleInput,
): Promise<ActionResult<{ suggestion: string }>> {
  const validated = generateAiTitleSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }

  const rateLimit = checkRateLimit(userId);
  if (!rateLimit.allowed) {
    return {
      success: false,
      error:
        "Rate limit exceeded. Daily generation limit reached. Try again tomorrow.",
    };
  }

  let row: { url: string; title: string | null };
  try {
    const results = await db
      .select({ url: bookmarks.url, title: bookmarks.title })
      .from(bookmarks)
      .where(
        and(
          eq(bookmarks.id, validated.data.bookmarkId),
          eq(bookmarks.userId, userId),
        ),
      )
      .limit(1);
    const first = results[0];
    if (!first) {
      return { success: false, error: "Bookmark not found" };
    }
    row = first;
  } catch (cause) {
    return dbError(cause);
  }

  const metadata = await fetchMetadata(row.url);

  try {
    const suggestion = await generateBookmarkTitle({
      url: row.url,
      currentTitle: row.title ?? "",
      description: metadata.description,
    });

    return { success: true, data: { suggestion } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to generate title",
    };
  }
}

// Repository returns raw rows; the action layer formats the export.
type BookmarkWithWorkspace = {
  id: string;
  url: string;
  title: string | null;
  favicon_url: string | null;
  og_image_url: string | null;
  created_at: string;
  workspace_id: string | null;
  workspaces: { id: string; name: string }[] | null;
};

export async function exportBookmarks(
  db: DrizzleDb,
  userId: string,
  options: z.infer<typeof exportOptionsSchema>,
): Promise<ActionResult<BookmarkWithWorkspace[]>> {
  try {
    // The original query used an inner join (`workspaces!inner`), so bookmarks
    // without a workspace were excluded from exports — innerJoin keeps that.
    const rows = await db
      .select({
        bookmark: bookmarks,
        workspace: { id: workspaces.id, name: workspaces.name },
      })
      .from(bookmarks)
      .innerJoin(workspaces, eq(workspaces.id, bookmarks.workspaceId))
      .where(
        and(
          eq(bookmarks.userId, userId),
          isNull(bookmarks.deletedAt),
          options.workspaceId
            ? eq(bookmarks.workspaceId, options.workspaceId)
            : undefined,
        ),
      )
      // Original PostgREST order: updated_at DESC NULLS LAST, then
      // created_at DESC — drizzle's desc() lacks a nulls clause, so spell it.
      .orderBy(
        sql`${bookmarks.updatedAt} desc nulls last, ${bookmarks.createdAt} desc`,
      );

    const data: BookmarkWithWorkspace[] = rows.map((row) => {
      const bm = row.bookmark;
      return {
        id: bm.id,
        url: bm.url,
        title: bm.title,
        favicon_url: bm.faviconUrl,
        og_image_url: bm.ogImageUrl,
        created_at: bm.createdAt.toISOString(),
        workspace_id: bm.workspaceId,
        workspaces: [{ id: row.workspace.id, name: row.workspace.name }],
      };
    });
    return { success: true, data };
  } catch (cause) {
    return dbError(cause);
  }
}
