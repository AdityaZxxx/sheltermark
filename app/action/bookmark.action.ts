"use server";

import type { ActionResult } from "~/lib/action-result";
import type {
  Bookmark,
  BookmarkCreateInput,
  BookmarkDeleteInput,
  BookmarkEditInput,
  BookmarkEmbedCheckInput,
  BookmarkMoveInput,
  BookmarkRefetchMetadataInput,
  BookmarkRenameInput,
  BookmarkUpdateNoteInput,
  GenerateAiTitleInput,
  InterpretSearchQueryInput,
} from "~/lib/schemas/bookmark.schema";
import type { Tag } from "~/lib/schemas/tag.schema";

import { invalidData } from "~/lib/action-result";
import { requireAuth } from "~/lib/auth";
import { getDb } from "~/lib/data/db";
import {
  deleteBookmarks as deleteBookmarksRepo,
  generateAiTitleRepo,
  getBookmarks as getBookmarksRepo,
  insertBookmark as insertBookmarkRepo,
  interpretSearchQueryRepo,
  moveBookmarks as moveBookmarksRepo,
  refetchMetadata as refetchMetadataRepo,
  renameBookmark as renameBookmarkRepo,
  suggestBookmarkTagsRepo,
  updateBookmarkFields as updateBookmarkFieldsRepo,
  updateBookmarkNote as updateBookmarkNoteRepo,
} from "~/lib/data/repositories/bookmark.repository";
import { isSafeUrl } from "~/lib/metadata/fetch";
import { bookmarkEmbedCheckSchema } from "~/lib/schemas/bookmark.schema";
import { httpFetch } from "~/lib/utils/http-fetch";

async function auth() {
  const { user } = await requireAuth();
  return { user, db: getDb() };
}

export async function addBookmark(
  data: BookmarkCreateInput,
): Promise<ActionResult<Bookmark>> {
  const { user, db } = await auth();
  const result = await insertBookmarkRepo(db, user.id, data);
  if (!result.success) {
    return {
      success: false,
      error: result.duplicate
        ? "Bookmark already exists in this workspace"
        : result.error,
    };
  }
  return { success: true, data: result.data };
}

export async function generateAiTitle(
  input: GenerateAiTitleInput,
): Promise<ActionResult<{ suggestion: string }>> {
  const { user, db } = await auth();
  return generateAiTitleRepo(db, user.id, input);
}

export async function suggestBookmarkTags(
  input: GenerateAiTitleInput,
): Promise<ActionResult<{ suggestions: string[] }>> {
  const { user, db } = await auth();
  return suggestBookmarkTagsRepo(db, user.id, input);
}

export async function interpretSearchQuery(
  input: InterpretSearchQueryInput,
): Promise<ActionResult<{ terms: string[] }>> {
  const { user } = await requireAuth();
  return interpretSearchQueryRepo(user.id, input);
}

// Browsers fire an iframe's load event even when the target refuses framing,
// so the client can't tell "loaded" from "blocked". Detect it here by reading
// the target's X-Frame-Options / CSP frame-ancestors headers. This only
// detects — it never bypasses — a site's embedding policy. The URL is
// user-controlled, so it goes through the same SSRF guard as the metadata
// pipeline (https-only, private-IP/DNS validation on every redirect hop).
export async function checkEmbeddable(
  input: BookmarkEmbedCheckInput,
): Promise<ActionResult<{ embeddable: boolean }>> {
  await requireAuth();
  const validated = bookmarkEmbedCheckSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: invalidData("checkEmbeddable", validated.error),
    };
  }

  if (!(await isSafeUrl(validated.data.url))) {
    // Don't probe unsafe URLs server-side; let the iframe try client-side.
    return { success: true, data: { embeddable: true } };
  }

  try {
    // GET, not HEAD: some sites (HN) 405 HEAD and omit XFO/CSP on the error
    // response, hiding their framing policy. The body is never read — only
    // headers are inspected — so GET costs nothing extra.
    const { response } = await httpFetch(validated.data.url, {
      timeout: 5_000,
      retries: 0,
      followRedirect: { maxHops: 5 },
      onRedirectHop: isSafeUrl,
    });
    return {
      success: true,
      data: { embeddable: isEmbeddable(response.headers) },
    };
  } catch {
    // Network failure or timeout: stay optimistic and let the iframe try.
    return { success: true, data: { embeddable: true } };
  }
}

function isEmbeddable(headers: Headers): boolean {
  const xfo = headers.get("x-frame-options")?.toLowerCase() ?? "";
  if (xfo.includes("deny") || xfo.includes("sameorigin")) return false;

  const csp = headers.get("content-security-policy") ?? "";
  const frameAncestors = /frame-ancestors\s+([^;]+)/i.exec(csp)?.[1];
  if (frameAncestors && !frameAncestors.includes("*")) return false;

  return true;
}

export async function deleteBookmarks({
  ids,
}: BookmarkDeleteInput): Promise<ActionResult<null>> {
  const { user, db } = await auth();
  return deleteBookmarksRepo(db, user.id, { ids });
}

export async function moveBookmarks({
  ids,
  targetWorkspaceId,
}: BookmarkMoveInput): Promise<
  ActionResult<{ movedCount: number; skippedCount: number }>
> {
  const { user, db } = await auth();
  return moveBookmarksRepo(db, user.id, { ids, targetWorkspaceId });
}

export async function renameBookmark({
  id,
  title,
}: BookmarkRenameInput): Promise<ActionResult<null>> {
  const { user, db } = await auth();
  return renameBookmarkRepo(db, user.id, { id, title });
}

export async function updateBookmarkNote({
  id,
  note,
}: BookmarkUpdateNoteInput): Promise<ActionResult<null>> {
  const { user, db } = await auth();
  return updateBookmarkNoteRepo(db, user.id, { id, note });
}

export async function refetchBookmarkMetadata(
  id: BookmarkRefetchMetadataInput,
): Promise<ActionResult<null>> {
  const { user, db } = await auth();
  return refetchMetadataRepo(db, user.id, id);
}

export async function getBookmarks(
  workspaceId?: string,
): Promise<ActionResult<Bookmark[]>> {
  const { user, db } = await auth();
  return getBookmarksRepo(db, user.id, workspaceId);
}

export async function updateBookmarkFields(
  input: BookmarkEditInput,
): Promise<ActionResult<Tag[]>> {
  const { user, db } = await auth();
  return updateBookmarkFieldsRepo(db, user.id, input);
}
