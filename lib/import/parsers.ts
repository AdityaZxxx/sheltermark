import { parseCSVLine } from "~/lib/import/csv";

export interface ParsedBookmark {
  id?: string;
  url: string;
  title: string;
  favicon_url?: string;
  og_image_url?: string;
  workspaceName?: string;
  workspaceId?: string;
}

export type ParseResult =
  | { success: true; bookmarks: ParsedBookmark[] }
  | { success: false; error: string };

export function parseImportFile(
  content: string,
  fileType: "json" | "csv",
): ParseResult {
  if (fileType === "json") return parseJSON(content);
  return parseCSV(content);
}

function parseJSON(content: string): ParseResult {
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

function parseCSV(content: string): ParseResult {
  try {
    const lines = content.trim().split("\n");
    if (lines.length < 2) {
      return {
        success: false,
        error: "CSV file is empty or has no data rows",
      };
    }

    const headers = (lines[0] ?? "")
      .split(",")
      .map((h) => h.trim().toLowerCase());
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
      const currentLine = lines[i] ?? "";
      const values = parseCSVLine(currentLine);
      const url = (values[urlIndex] ?? "").trim();

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
