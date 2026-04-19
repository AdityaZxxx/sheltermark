"use server";

import { requireAuth } from "~/lib/auth";
import { importOptionsSchema } from "~/lib/schemas/profile";
import { normalizeUrl } from "~/lib/utils";

type ImportPreviewResult = {
  success: true;
  totalBookmarks: number;
  validBookmarks: number;
  duplicates: number;
  workspaces: Array<{ name: string; count: number }>;
};

type ImportResult =
  | { success: true; imported: number; skipped: number; errors: string[] }
  | { success: false; error: string };

interface ParsedBookmark {
  id?: string;
  url: string;
  title: string;
  favicon_url?: string;
  og_image_url?: string;
  workspaceName?: string;
  workspaceId?: string;
}

type BookmarkInsertInput = Pick<
  Bookmark,
  "user_id" | "workspace_id" | "url" | "title" | "favicon_url" | "og_image_url"
>;

export async function previewImport(
  fileContent: string,
  fileType: "json" | "csv",
  options?: {
    targetWorkspaceId?: string | null;
    createWorkspace?: boolean;
    newWorkspaceName?: string;
  },
): Promise<ImportPreviewResult | { success: false; error: string }> {
  try {
    const parsed = parseFile(fileContent, fileType);
    if (!parsed.success) return parsed;

    const { user, supabase } = await requireAuth();

    const urls = parsed.bookmarks.map((b) => b.url);

    // Query duplicates only in target workspace if specified
    let query = supabase
      .from("bookmarks")
      .select("url, workspace_id, workspaces(name)")
      .eq("user_id", user.id)
      .in("url", urls);

    // If creating new workspace, no need to check duplicates (new workspace is empty)
    // If targeting existing workspace, check duplicates only in that workspace
    const isNewWorkspace =
      options?.createWorkspace || !options?.targetWorkspaceId;

    if (!isNewWorkspace && options?.targetWorkspaceId) {
      query = query.eq("workspace_id", options.targetWorkspaceId);
    }

    const { data: existing } = await query;

    // For new workspace, duplicates should be 0 (we're creating a new workspace)
    const duplicateCount = isNewWorkspace ? 0 : existing?.length || 0;

    const workspaceCounts: Record<string, number> = {};
    for (const bookmark of parsed.bookmarks) {
      const wsName = bookmark.workspaceName || "Imported - Browser";
      workspaceCounts[wsName] = (workspaceCounts[wsName] || 0) + 1;
    }

    return {
      success: true,
      totalBookmarks: parsed.bookmarks.length,
      validBookmarks: parsed.bookmarks.length,
      duplicates: duplicateCount,
      workspaces: Object.entries(workspaceCounts).map(([name, count]) => ({
        name,
        count,
      })),
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function importBookmarks(
  fileContent: string,
  fileType: "json" | "csv",
  options: z.infer<typeof importOptionsSchema>,
): Promise<ImportResult> {
  const validated = importOptionsSchema.safeParse(options);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0].message };
  }

  const parsed = parseFile(fileContent, fileType);
  if (!parsed.success) return parsed;

  const { user, supabase } = await requireAuth();

  let targetWorkspaceId: string | null | undefined =
    validated.data.targetWorkspaceId;

  // Create new workspace if requested
  if (validated.data.createWorkspace && validated.data.newWorkspaceName) {
    const { data: ws, error: wsError } = await supabase
      .from("workspaces")
      .insert({
        name: validated.data.newWorkspaceName,
        user_id: user.id,
        is_default: false,
        is_public: false,
      })
      .select("id")
      .single();

    if (wsError) {
      return {
        success: false,
        error: `Failed to create workspace: ${wsError.message}`,
      };
    }

    if (!ws) {
      return {
        success: false,
        error: "Failed to create workspace: no data returned",
      };
    }

    targetWorkspaceId = ws.id;
  }

  // If no workspace specified and not creating new one, use default workspace
  if (!targetWorkspaceId && !validated.data.createWorkspace) {
    const { data: defaultWs } = await supabase
      .from("workspaces")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_default", true)
      .maybeSingle();

    if (defaultWs) {
      targetWorkspaceId = defaultWs.id;
    }
  }

  // Only check duplicates in the target workspace, not all workspaces
  let query = supabase.from("bookmarks").select("url").eq("user_id", user.id);

  if (targetWorkspaceId) {
    query = query.eq("workspace_id", targetWorkspaceId);
  }

  const { data: existingBookmarks } = await query;

  // Normalize existing URLs for comparison
  const existingUrls = new Set(
    existingBookmarks?.map((b) => normalizeUrl(b.url)) || [],
  );

  const errors: string[] = [];
  const toInsert: BookmarkInsertInput[] = [];

  for (const bookmark of parsed.bookmarks) {
    try {
      new URL(bookmark.url);
    } catch {
      errors.push(`Invalid URL: ${bookmark.url}`);
      continue;
    }

    const normalizedUrl = normalizeUrl(bookmark.url);

    // Only check duplicate in target workspace, not across all workspaces
    if (targetWorkspaceId && existingUrls.has(normalizedUrl)) {
      if (validated.data.duplicateStrategy === "skip") {
        continue;
      }

      await supabase
        .from("bookmarks")
        .delete()
        .eq("user_id", user.id)
        .eq("url", normalizedUrl)
        .eq("workspace_id", targetWorkspaceId);
    }

    toInsert.push({
      user_id: user.id,
      workspace_id: targetWorkspaceId || null,
      url: normalizedUrl,
      title: bookmark.title || bookmark.url,
      favicon_url: bookmark.favicon_url || null,
      og_image_url: bookmark.og_image_url || null,
    });
  }

  if (toInsert.length === 0) {
    return {
      success: true,
      imported: 0,
      skipped: parsed.bookmarks.length,
      errors,
    };
  }

  const batchSize = 100;
  let imported = 0;

  for (let i = 0; i < toInsert.length; i += batchSize) {
    const batch = toInsert.slice(i, i + batchSize);
    const { error } = await supabase.from("bookmarks").insert(batch);

    if (error) {
      errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
    } else {
      imported += batch.length;
    }
  }

  return {
    success: true,
    imported,
    skipped: parsed.bookmarks.length - imported,
    errors,
  };
}

function parseFile(
  content: string,
  fileType: "json" | "csv",
):
  | { success: true; bookmarks: ParsedBookmark[] }
  | { success: false; error: string } {
  if (fileType === "json") {
    return parseJSON(content);
  }
  return parseCSV(content);
}

function parseJSON(
  content: string,
):
  | { success: true; bookmarks: ParsedBookmark[] }
  | { success: false; error: string } {
  try {
    const data = JSON.parse(content);
    const bookmarks: ParsedBookmark[] = [];

    if (data.workspaces && Array.isArray(data.workspaces)) {
      for (const ws of data.workspaces) {
        const wsName = ws.name || "Imported";
        const wsId = ws.id;
        if (ws.bookmarks && Array.isArray(ws.bookmarks)) {
          for (const bm of ws.bookmarks) {
            bookmarks.push({
              id: bm.id,
              url: bm.url,
              title: bm.title || "",
              favicon_url: bm.faviconUrl || bm.favicon_url || null,
              og_image_url: bm.ogImageUrl || bm.og_image_url || null,
              workspaceName: wsName,
              workspaceId: wsId,
            });
          }
        }
      }
    } else if (data.bookmarks && Array.isArray(data.bookmarks)) {
      for (const bm of data.bookmarks) {
        bookmarks.push({
          id: bm.id,
          url: bm.url,
          title: bm.title || "",
          favicon_url: bm.faviconUrl || bm.favicon_url || null,
          og_image_url: bm.ogImageUrl || bm.og_image_url || null,
        });
      }
    }

    if (bookmarks.length === 0) {
      return { success: false, error: "No bookmarks found in file" };
    }

    return { success: true, bookmarks };
  } catch {
    return { success: false, error: "Invalid JSON format" };
  }
}

function parseCSV(
  content: string,
):
  | { success: true; bookmarks: ParsedBookmark[] }
  | { success: false; error: string } {
  try {
    const lines = content.trim().split("\n");
    if (lines.length < 2) {
      return { success: false, error: "CSV file is empty or has no data rows" };
    }

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const idIndex = headers.indexOf("id");
    const urlIndex = headers.indexOf("url");
    const titleIndex = headers.indexOf("title");
    const workspaceIdIndex = headers.indexOf("workspace_id");
    const workspaceIndex = headers.indexOf("workspace");
    const faviconIndex = headers.indexOf("favicon_url");
    const ogImageIndex = headers.indexOf("og_image_url");

    if (urlIndex === -1) {
      return { success: false, error: "CSV must have a 'url' column" };
    }

    const bookmarks: ParsedBookmark[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const url = values[urlIndex]?.trim();

      if (!url) continue;

      const id = idIndex !== -1 ? values[idIndex]?.trim() : undefined;
      const title = titleIndex !== -1 ? values[titleIndex]?.trim() || "" : "";
      const workspaceId =
        workspaceIdIndex !== -1 ? values[workspaceIdIndex]?.trim() : undefined;
      const workspaceName =
        workspaceIndex !== -1 ? values[workspaceIndex]?.trim() : undefined;
      const favicon_url =
        faviconIndex !== -1
          ? values[faviconIndex]?.trim() || undefined
          : undefined;
      const og_image_url =
        ogImageIndex !== -1
          ? values[ogImageIndex]?.trim() || undefined
          : undefined;

      bookmarks.push({
        id,
        url,
        title,
        workspaceId,
        workspaceName,
        favicon_url,
        og_image_url,
      });
    }

    if (bookmarks.length === 0) {
      return { success: false, error: "No valid bookmarks found in CSV" };
    }

    return { success: true, bookmarks };
  } catch {
    return { success: false, error: "Invalid CSV format" };
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

import type { z } from "zod";
import type { Bookmark } from "../../lib/schemas/bookmark";
