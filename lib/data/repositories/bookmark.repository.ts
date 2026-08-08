import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type { ActionResult } from "~/lib/action-result";
import { generateBookmarkTitle } from "~/lib/ai/generate-title";
import { checkRateLimit } from "~/lib/ai/rate-limit";
import type { DbClient } from "~/lib/data/db-client";
import { upsertTag } from "~/lib/data/repositories/tag.repository";
import { fetchMetadata } from "~/lib/metadata";
import type { Bookmark } from "~/lib/schemas/bookmark.schema";
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
import type { exportOptionsSchema } from "~/lib/schemas/profile.schema";
import type { Tag, Tag as TagRow } from "~/lib/schemas/tag.schema";
import { resolveAndReplaceBookmarkTags } from "~/lib/services/tag.service";
import { normalizeUrl } from "~/lib/utils";

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
  | { success: true; data: Bookmark; tags: TagRow[] }
  | { success: false; duplicate: true }
  | { success: false; duplicate?: false; error: string };

export async function insertBookmark(
  supabase: DbClient,
  userId: string,
  { url, workspaceId, clientTitle, tagNames }: InsertBookmarkParams,
): Promise<InsertBookmarkResult> {
  const normalizedUrl = normalizeUrl(url);

  let existingQuery = supabase
    .from("bookmarks")
    .select("id")
    .eq("user_id", userId)
    .eq("url", normalizedUrl)
    .is("deleted_at", null);

  if (workspaceId) {
    existingQuery = existingQuery.eq("workspace_id", workspaceId);
  } else {
    existingQuery = existingQuery.is("workspace_id", null);
  }

  const [existing, metadata] = await Promise.all([
    existingQuery.maybeSingle(),
    fetchMetadata(url),
  ]);

  if (existing.data) {
    return { success: false, duplicate: true };
  }

  // Explicit user-supplied title wins over fetched metadata; both fall back
  // to "Untitled". (Previously metadata always won, which silently ignored
  // any title the client sent.)
  const title =
    clientTitle && clientTitle.trim().length > 0
      ? clientTitle
      : (metadata?.title ?? "Untitled");

  const { data, error } = await supabase
    .from("bookmarks")
    .insert([
      {
        user_id: userId,
        url: normalizedUrl,
        workspace_id: workspaceId || null,
        title,
        favicon_url: metadata?.favicon_url ?? null,
        og_image_url: metadata?.og_image_url ?? null,
      },
    ])
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  const bookmark = data as Bookmark;

  // Apply optional tag names atomically-ish: resolve-or-create each by name
  // (reusing existing primitives, not a parallel tag system), then link.
  // Post-insert failures leave the bookmark saved but return an error so the
  // caller never reports a broken partial state as success.
  if (tagNames && tagNames.length > 0) {
    const deduped = dedupeTagNames(tagNames);
    const resolved: TagRow[] = [];
    for (const name of deduped) {
      const upserted = await upsertTag(
        supabase as unknown as SupabaseClient,
        userId,
        name,
      );
      if (!upserted.success) return { success: false, error: upserted.error };
      resolved.push(upserted.data);
    }
    if (resolved.length > 0) {
      const { error: linkError } = await supabase.from("bookmark_tags").insert(
        resolved.map((tag) => ({
          bookmark_id: bookmark.id,
          tag_id: tag.id,
        })),
      );
      if (linkError) return { success: false, error: linkError.message };
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
  supabase: DbClient,
  userId: string,
  workspaceId?: string,
): Promise<ActionResult<Bookmark[]>> {
  let query = supabase
    .from("bookmarks")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (workspaceId) {
    query = query.eq("workspace_id", workspaceId);
  }

  const { data: bookmarks, error } = await query;

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: (bookmarks as Bookmark[]) ?? [] };
}

export async function deleteBookmarks(
  supabase: DbClient,
  userId: string,
  { ids }: BookmarkDeleteInput,
): Promise<ActionResult<null>> {
  const validated = bookmarkDeleteSchema.safeParse({ ids });
  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }

  const { error } = await supabase
    .from("bookmarks")
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .in("id", validated.data.ids)
    .eq("user_id", userId);

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

export async function getTrashedBookmarks(
  supabase: DbClient,
  userId: string,
): Promise<ActionResult<Bookmark[]>> {
  const { data, error } = await supabase
    .from("bookmarks")
    .select("*")
    .eq("user_id", userId)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data as Bookmark[]) ?? [] };
}

export type BatchBookmarkInput = {
  url: string;
  title: string;
  favicon_url?: string | null;
  og_image_url?: string | null;
};

export async function batchInsertBookmarks(
  supabase: DbClient,
  userId: string,
  workspaceId: string | null,
  bookmarks: BatchBookmarkInput[],
  options?: { duplicateStrategy?: "skip" | "replace" },
): Promise<
  ActionResult<{ imported: number; skipped: number; errors: string[] }>
> {
  const errors: string[] = [];
  const toInsert: BatchBookmarkInput[] = [];
  const replaceUrls: string[] = [];
  const strategy = options?.duplicateStrategy ?? "skip";

  let existingQuery = supabase
    .from("bookmarks")
    .select("url")
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (workspaceId) {
    existingQuery = existingQuery.eq("workspace_id", workspaceId);
  } else {
    existingQuery = existingQuery.is("workspace_id", null);
  }

  const { data: existingData } = await existingQuery;
  const existingUrls = new Set((existingData ?? []).map((b) => b.url));

  for (const bookmark of bookmarks) {
    try {
      new URL(bookmark.url);
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
    let deleteQuery = supabase
      .from("bookmarks")
      .delete()
      .eq("user_id", userId)
      .in("url", replaceUrls);
    if (workspaceId) {
      deleteQuery = deleteQuery.eq("workspace_id", workspaceId);
    } else {
      deleteQuery = deleteQuery.is("workspace_id", null);
    }
    const { error: deleteError } = await deleteQuery;
    if (deleteError) {
      errors.push(`Replace deletions: ${deleteError.message}`);
    }
  }

  if (toInsert.length === 0) {
    return {
      success: true,
      data: { imported: 0, skipped: bookmarks.length, errors },
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

  const insertPayloads = batches.map(({ batch }) =>
    batch.map((bm) => ({
      user_id: userId,
      workspace_id: workspaceId,
      url: bm.url,
      title: bm.title,
      favicon_url: bm.favicon_url || null,
      og_image_url: bm.og_image_url || null,
    })),
  );

  const batchResults = await Promise.allSettled(
    insertPayloads.map((payload) => supabase.from("bookmarks").insert(payload)),
  );

  let imported = 0;
  for (let i = 0; i < batchResults.length; i++) {
    const result = batchResults[i];
    if (!result) continue;
    const batchLabel = i + 1;
    if (result.status === "fulfilled") {
      if (!result.value.error) {
        imported += insertPayloads[i]?.length ?? 0;
      } else {
        errors.push(`Batch ${batchLabel}: ${result.value.error.message}`);
      }
    } else {
      errors.push(
        `Batch ${batchLabel}: ${result.reason?.message ?? "Insert failed"}`,
      );
    }
  }

  return {
    success: true,
    data: { imported, skipped: bookmarks.length - imported, errors },
  };
}

export async function permanentDeleteBookmarks(
  supabase: DbClient,
  userId: string,
  { ids }: BookmarkDeleteInput,
): Promise<ActionResult<null>> {
  const validated = bookmarkDeleteSchema.safeParse({ ids });
  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }

  const { error } = await supabase
    .from("bookmarks")
    .delete()
    .in("id", validated.data.ids)
    .eq("user_id", userId);

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

export async function emptyTrashBookmarks(
  supabase: DbClient,
  userId: string,
): Promise<ActionResult<null>> {
  const { error } = await supabase
    .from("bookmarks")
    .delete()
    .not("deleted_at", "is", null)
    .eq("user_id", userId);

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

export async function moveBookmarks(
  supabase: DbClient,
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

  // 1. Get the URLs of the bookmarks to be moved
  const { data: sourceBookmarks, error: fetchError } = await supabase
    .from("bookmarks")
    .select("id, url")
    .in("id", sourceIds)
    .eq("user_id", userId);

  if (fetchError) return { success: false, error: fetchError.message };
  if (!sourceBookmarks || sourceBookmarks.length === 0)
    return { success: false, error: "No bookmarks found to move" };

  const sourceUrls = sourceBookmarks.map((b) => (b as { url: string }).url);

  // 2. Check for existing (non-trashed) URLs in the target workspace
  let existingQuery = supabase
    .from("bookmarks")
    .select("url")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .in("url", sourceUrls);

  if (targetId) {
    existingQuery = existingQuery.eq("workspace_id", targetId);
  } else {
    existingQuery = existingQuery.is("workspace_id", null);
  }

  const { data: existingInTarget, error: checkError } = await existingQuery;
  if (checkError) return { success: false, error: checkError.message };

  const existingUrls = new Set(existingInTarget?.map((b) => b.url) ?? []);

  // 3. Separate IDs into those to move and those to skip
  const toMoveIds: string[] = [];
  let skippedCount = 0;
  for (const bookmark of sourceBookmarks as { id: string; url: string }[]) {
    if (existingUrls.has(bookmark.url)) {
      skippedCount++;
    } else {
      toMoveIds.push(bookmark.id);
    }
  }

  // 4. Perform the move for non-duplicates
  if (toMoveIds.length > 0) {
    const { error: moveError } = await supabase
      .from("bookmarks")
      .update({ workspace_id: targetId, updated_at: new Date().toISOString() })
      .in("id", toMoveIds)
      .eq("user_id", userId);
    if (moveError) return { success: false, error: moveError.message };
  }

  return {
    success: true,
    data: {
      movedCount: toMoveIds.length,
      skippedCount,
    },
  };
}

export async function renameBookmark(
  supabase: DbClient,
  userId: string,
  { id, title }: BookmarkRenameInput,
): Promise<ActionResult<null>> {
  const validated = bookmarkRenameSchema.safeParse({ id, title });
  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }

  const { error } = await supabase
    .from("bookmarks")
    .update({
      title: validated.data.title,
      updated_at: new Date().toISOString(),
    })
    .eq("id", validated.data.id)
    .eq("user_id", userId);

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

export async function updateBookmarkNote(
  supabase: DbClient,
  userId: string,
  { id, note }: BookmarkUpdateNoteInput,
): Promise<ActionResult<null>> {
  const validated = bookmarkUpdateNoteSchema.safeParse({ id, note });
  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }

  const { error } = await supabase
    .from("bookmarks")
    .update({
      note: validated.data.note,
      updated_at: new Date().toISOString(),
    })
    .eq("id", validated.data.id)
    .eq("user_id", userId);

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

export async function updateBookmarkFields(
  supabase: DbClient,
  userId: string,
  input: BookmarkEditInput,
): Promise<ActionResult<Tag[]>> {
  const validated = bookmarkEditSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }

  const { id, title, note, tags } = validated.data;
  const now = new Date().toISOString();

  const { error: bookmarkError } = await supabase
    .from("bookmarks")
    .update({ title, note, updated_at: now })
    .eq("id", id)
    .eq("user_id", userId);

  if (bookmarkError) {
    return { success: false, error: bookmarkError.message };
  }

  const tagResult = await resolveAndReplaceBookmarkTags(
    supabase as unknown as SupabaseClient,
    userId,
    id,
    tags,
  );
  if (!tagResult.success) return tagResult;

  return { success: true, data: tagResult.data };
}

export async function refetchMetadata(
  supabase: DbClient,
  userId: string,
  id: BookmarkRefetchMetadataInput,
): Promise<ActionResult<null>> {
  const validated = bookmarkRefetchMetadataSchema.safeParse(id);
  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }

  const { data: bookmark, error: fetchError } = await supabase
    .from("bookmarks")
    .select("id, url, favicon_url, og_image_url")
    .eq("id", validated.data.id)
    .eq("user_id", userId)
    .single();

  if (fetchError || !bookmark) {
    return { success: false, error: "Bookmark not found" };
  }

  const bm = bookmark as { url: string; title: string };
  const metadata = await fetchMetadata(bm.url);

  const { error: updateError } = await supabase
    .from("bookmarks")
    .update({
      favicon_url: metadata?.favicon_url ?? null,
      og_image_url: metadata?.og_image_url ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", validated.data.id)
    .eq("user_id", userId);

  if (updateError) return { success: false, error: updateError.message };

  return { success: true, data: null };
}

export async function generateAiTitleRepo(
  supabase: DbClient,
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

  const { data: bookmark, error: fetchError } = await supabase
    .from("bookmarks")
    .select("url, title")
    .eq("id", validated.data.bookmarkId)
    .eq("user_id", userId)
    .single();

  if (fetchError || !bookmark) {
    return { success: false, error: "Bookmark not found" };
  }

  const bm = bookmark as { url: string; title: string };
  const metadata = await fetchMetadata(bm.url);

  try {
    const suggestion = await generateBookmarkTitle({
      url: bm.url,
      currentTitle: bm.title,
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

// ----------------- Export bookmarks (query only) -----------------
// This function queries Supabase for bookmarks along with their associated
// workspaces. It returns raw data which will be formatted by the action layer.
type BookmarkWithWorkspace = {
  id: string;
  url: string;
  title: string | null;
  favicon_url: string | null;
  og_image_url: string | null;
  created_at: string;
  workspace_id: string | null;
  workspaces: { id: number; name: string }[] | null;
};

export async function exportBookmarks(
  supabase: DbClient,
  userId: string,
  options: z.infer<typeof exportOptionsSchema>,
): Promise<ActionResult<BookmarkWithWorkspace[]>> {
  // Build base query to fetch bookmarks with their workspace information
  let query = supabase
    .from("bookmarks")
    .select(`
      id,
      url,
      title,
      favicon_url,
      og_image_url,
      created_at,
      workspace_id,
      workspaces!inner(id, name)
    `)
    .eq("user_id", userId)
    .is("deleted_at", null);

  // Optional workspace filter
  if (options.workspaceId) {
    query = query.eq("workspace_id", options.workspaceId);
  }

  const { data, error } = await query
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }

  const bookmarksData = (data ?? []) as BookmarkWithWorkspace[];
  return { success: true, data: bookmarksData };
}
