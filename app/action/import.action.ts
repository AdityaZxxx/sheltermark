"use server";

import type { ActionResult } from "~/lib/action-result";
import type { ImportFileType } from "~/lib/import/parsers";
import type { ImportOptionsInput } from "~/lib/schemas/profile.schema";

import { requireAuth } from "~/lib/auth";
import { getDb } from "~/lib/data/drizzle";
import { batchInsertBookmarks } from "~/lib/data/repositories/bookmark.repository";
import {
  createWorkspaceRaw,
  getDefaultWorkspace,
} from "~/lib/data/repositories/workspace.repository";
import { filterByFolders } from "~/lib/import/folder-filter";
import { parseImportFile } from "~/lib/import/parsers";
import { importOptionsSchema } from "~/lib/schemas/profile.schema";

export async function previewImport(
  fileContent: string,
  fileType: ImportFileType,
  options?: {
    targetWorkspaceId?: string | null;
    createWorkspace?: boolean;
    newWorkspaceName?: string;
    /** Browser-import folder filter. Empty/undefined = all folders. */
    folderPaths?: string[];
  },
): Promise<
  ActionResult<{
    totalBookmarks: number;
    validBookmarks: number;
    duplicates: number;
    workspaces: { name: string; count: number }[];
  }>
> {
  try {
    const parsed = parseImportFile(fileContent, fileType);
    if (!parsed.success) {
      return { success: false, error: parsed.error ?? "Parse error" };
    }
    const rawBookmarks = parsed.bookmarks ?? [];

    // Apply browser-import folder filter. The client always sends
    // folderPaths for Netscape imports (possibly empty if user deselected
    // everything), so we apply the filter unconditionally for that case.
    const applyFilter = fileType === "netscape";
    const folderSet = new Set(options?.folderPaths ?? []);
    const bookmarksFromParse = applyFilter
      ? filterByFolders(rawBookmarks, folderSet)
      : rawBookmarks;

    const { user, supabase } = await requireAuth();

    const urls = bookmarksFromParse.map((b) => b.url);

    let query = supabase
      .from("bookmarks")
      .select("url, workspace_id, workspaces(name)")
      .eq("user_id", user.id)
      .in("url", urls);

    const isNewWorkspace =
      options?.createWorkspace || !options?.targetWorkspaceId;

    if (!isNewWorkspace && options?.targetWorkspaceId) {
      query = query.eq("workspace_id", options.targetWorkspaceId);
    }

    const { data: existing } = await query;

    const duplicateCount = isNewWorkspace ? 0 : (existing?.length ?? 0);

    const workspaceCounts: Record<string, number> = {};
    for (const bookmark of bookmarksFromParse) {
      const wsName = bookmark.workspaceName || "Imported - Browser";
      workspaceCounts[wsName] = (workspaceCounts[wsName] || 0) + 1;
    }

    return {
      success: true,
      data: {
        totalBookmarks: bookmarksFromParse.length,
        validBookmarks: bookmarksFromParse.length,
        duplicates: duplicateCount,
        workspaces: Object.entries(workspaceCounts).map(([name, count]) => ({
          name,
          count,
        })),
      },
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

type ImportResult = { imported: number; skipped: number; errors: string[] };

export async function importBookmarks(
  fileContent: string,
  fileType: ImportFileType,
  options: ImportOptionsInput,
): Promise<ActionResult<ImportResult>> {
  const validated = importOptionsSchema.safeParse(options);
  if (!validated.success) {
    const msg =
      validated.error?.issues?.[0]?.message ?? "Invalid import options";
    return { success: false, error: msg };
  }

  const parsed = parseImportFile(fileContent, fileType);
  if (!parsed.success) {
    return { success: false, error: parsed.error ?? "Parse error" };
  }

  const folderSet = new Set(validated.data.folderPaths ?? []);
  const bookmarksToImport =
    fileType === "netscape"
      ? filterByFolders(parsed.bookmarks, folderSet)
      : parsed.bookmarks;

  if (bookmarksToImport.length === 0) {
    return {
      success: true,
      data: { imported: 0, skipped: 0, errors: [] },
    };
  }

  const { user } = await requireAuth();

  let targetWorkspaceId: string | null | undefined =
    validated.data.targetWorkspaceId;

  if (validated.data.createWorkspace && validated.data.newWorkspaceName) {
    const result = await createWorkspaceRaw(
      getDb(),
      user.id,
      validated.data.newWorkspaceName,
    );

    if (!result.success) {
      return result;
    }

    targetWorkspaceId = result.data.id;
  }

  if (!targetWorkspaceId && !validated.data.createWorkspace) {
    const result = await getDefaultWorkspace(getDb(), user.id);

    if (!result.success) {
      return result;
    }

    if (result.data) {
      targetWorkspaceId = result.data.id;
    }
  }

  return batchInsertBookmarks(
    getDb(),
    user.id,
    targetWorkspaceId ?? null,
    bookmarksToImport,
    {
      duplicateStrategy: validated.data.duplicateStrategy,
    },
  );
}
