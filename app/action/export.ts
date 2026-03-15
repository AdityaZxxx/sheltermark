"use server";

import type { z } from "zod";
import { requireAuth } from "~/lib/auth";
import { exportOptionsSchema } from "~/lib/schemas";

export type ExportResult =
  | { success: true; data: string; filename: string; contentType: string }
  | { success: false; error: string };

export async function exportBookmarks(
  options: z.infer<typeof exportOptionsSchema>,
): Promise<ExportResult> {
  const validated = exportOptionsSchema.safeParse(options);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0].message };
  }

  const { user, supabase } = await requireAuth();

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
    .eq("user_id", user.id);

  if (validated.data.workspaceId) {
    query = query.eq("workspace_id", validated.data.workspaceId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }

  const format = validated.data.format;

  if (format === "json") {
    const exportData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      workspaces: groupBookmarksByWorkspace(data || []),
    };

    return {
      success: true,
      data: JSON.stringify(exportData, null, 2),
      filename: `sheltermark-export-${formatDate(new Date())}.json`,
      contentType: "application/json",
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
      ...(data || []).map((bookmark) =>
        [
          escapeCSV(bookmark.workspace_id || ""),
          escapeCSV(
            (bookmark.workspaces as unknown as { name: string })?.name || "",
          ),
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
      data: rows.join("\n"),
      filename: `sheltermark-export-${formatDate(new Date())}.csv`,
      contentType: "text/csv",
    };
  }

  return { success: false, error: "Invalid format" };
}

function groupBookmarksByWorkspace(
  bookmarks: Array<{
    id: string;
    url: string;
    title: string | null;
    favicon_url: string | null;
    og_image_url: string | null;
    created_at: string;
    workspace_id: string | null;
    workspaces: unknown;
  }>,
) {
  const groups: Record<string, (typeof bookmarks)[0][]> = {};

  for (const bookmark of bookmarks) {
    const workspaceName =
      (bookmark.workspaces as unknown as { name: string })?.name ||
      "Uncategorized";
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

function escapeCSV(value: string): string {
  if (!value) return "";
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}
