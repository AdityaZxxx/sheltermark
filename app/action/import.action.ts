"use server";

import type { ActionResult } from "~/lib/action-result";
import { requireAuth } from "~/lib/auth";
import type { DbClient } from "~/lib/data/db-client";
import { batchInsertBookmarks } from "~/lib/data/repositories/bookmark.repository";
import {
  createWorkspaceRaw,
  getDefaultWorkspace,
} from "~/lib/data/repositories/workspace.repository";
import { parseImportFile } from "~/lib/import/parsers";
import type { ImportOptionsInput } from "~/lib/schemas/profile.schema";
import { importOptionsSchema } from "~/lib/schemas/profile.schema";

export async function previewImport(
  fileContent: string,
  fileType: "json" | "csv",
  options?: {
    targetWorkspaceId?: string | null;
    createWorkspace?: boolean;
    newWorkspaceName?: string;
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
    const bookmarksFromParse = parsed.bookmarks ?? [];

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
  fileType: "json" | "csv",
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

  const { user, supabase } = await requireAuth();

  let targetWorkspaceId: string | null | undefined =
    validated.data.targetWorkspaceId;

  if (validated.data.createWorkspace && validated.data.newWorkspaceName) {
    const result = await createWorkspaceRaw(
      supabase as unknown as DbClient,
      user.id,
      validated.data.newWorkspaceName,
    );

    if (!result.success) {
      return result;
    }

    targetWorkspaceId = result.data.id;
  }

  if (!targetWorkspaceId && !validated.data.createWorkspace) {
    const result = await getDefaultWorkspace(
      supabase as unknown as DbClient,
      user.id,
    );

    if (!result.success) {
      return result;
    }

    if (result.data) {
      targetWorkspaceId = result.data.id;
    }
  }

  return batchInsertBookmarks(
    supabase as unknown as DbClient,
    user.id,
    targetWorkspaceId ?? null,
    parsed.bookmarks,
    {
      duplicateStrategy: validated.data.duplicateStrategy,
    },
  );
}
