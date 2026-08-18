"use server";

import type { z } from "zod";

import type { ActionResult } from "~/lib/action-result";

import { requireAuth } from "~/lib/auth";
import { getDb } from "~/lib/data/drizzle";
import { exportBookmarks as repoExportBookmarks } from "~/lib/data/repositories/bookmark.repository";
import { escapeCSV } from "~/lib/import/csv";
import { exportOptionsSchema } from "~/lib/schemas/profile.schema";

interface WorkspaceInfo {
  id: string;
  name: string;
}

interface BookmarkWithWorkspace {
  id: string;
  url: string;
  title: string | null;
  favicon_url: string | null;
  og_image_url: string | null;
  created_at: string;
  workspace_id: string | null;
  workspaces: WorkspaceInfo[] | null;
}

export async function exportBookmarks(
  options: z.infer<typeof exportOptionsSchema>,
): Promise<
  ActionResult<{ content: string; filename: string; contentType: string }>
> {
  const validated = exportOptionsSchema.safeParse(options);
  if (!validated.success) {
    const msg =
      validated.error?.issues?.[0]?.message ?? "Invalid export options";
    return { success: false, error: msg };
  }

  const { user } = await requireAuth();

  const repoResult = await repoExportBookmarks(
    getDb(),
    user.id,
    validated.data,
  );

  if (!repoResult.success) {
    return { success: false, error: repoResult.error };
  }

  const bookmarksData = repoResult.data;

  const format = validated.data.format;
  if (format === "json") {
    const exportData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      workspaces: groupBookmarksByWorkspace(bookmarksData),
    };

    return {
      success: true,
      data: {
        content: JSON.stringify(exportData, null, 2),
        filename: `sheltermark-export-${formatDate(new Date())}.json`,
        contentType: "application/json",
      },
    };
  }

  if (format === "csv") {
    const rows = [
      [
        "workspace_id",
        "workspace",
        "id",
        "url",
        "title",
        "favicon_url",
        "og_image_url",
        "created_at",
      ].join(","),
      ...bookmarksData.map((bookmark) =>
        [
          escapeCSV(bookmark.workspace_id || ""),
          escapeCSV(bookmark.workspaces?.[0]?.name ?? ""),
          escapeCSV(bookmark.id),
          escapeCSV(bookmark.url),
          escapeCSV(bookmark.title || ""),
          escapeCSV(bookmark.favicon_url || ""),
          escapeCSV(bookmark.og_image_url || ""),
          bookmark.created_at,
        ].join(","),
      ),
    ];

    return {
      success: true,
      data: {
        content: rows.join("\n"),
        filename: `sheltermark-export-${formatDate(new Date())}.csv`,
        contentType: "text/csv",
      },
    };
  }

  return { success: false, error: "Invalid format" };
}

function groupBookmarksByWorkspace(bookmarks: BookmarkWithWorkspace[]) {
  const groups: Record<string, BookmarkWithWorkspace[]> = {};

  for (const bookmark of bookmarks) {
    const workspaceName = bookmark.workspaces?.[0]?.name ?? "Uncategorized";
    if (!groups[workspaceName]) {
      groups[workspaceName] = [];
    }
    groups[workspaceName].push(bookmark);
  }

  return Object.entries(groups).map(([name, items]) => ({
    name,
    bookmarks: items.map((b) => ({
      id: b.id,
      url: b.url,
      title: b.title,
      faviconUrl: b.favicon_url,
      ogImageUrl: b.og_image_url,
      createdAt: b.created_at,
    })),
  }));
}

function formatDate(date: Date): string {
  const iso = date.toISOString();
  const tIndex = iso.indexOf("T");
  return tIndex === -1 ? iso : iso.substring(0, tIndex);
}
