import { z } from "zod";

/**
 * The canonical Sheltermark JSON export shape (version 1.0). Cloud Backup
 * reuses this exact format — there is no separate backup format (ADR-0008).
 */
interface CanonicalExport {
  version: "1.0";
  exportedAt: string;
  workspaces: {
    name: string;
    bookmarks: {
      id: string;
      url: string;
      title: string | null;
      faviconUrl: string | null;
      ogImageUrl: string | null;
      createdAt: string;
      /** Present in backups; free-form user note. */
      note?: string | null;
      /** Present in backups; tag names. */
      tags?: string[];
    }[];
  }[];
}

/** Row shape produced by the bookmark repository for export/backup. */
export interface ExportBookmarkRow {
  id: string;
  url: string;
  title: string | null;
  favicon_url: string | null;
  og_image_url: string | null;
  note: string | null;
  created_at: string;
  workspace_id: string | null;
  workspaces: { id: string; name: string }[] | null;
  tags?: string[];
}

const bookmarkSchema = z.object({
  id: z
    .string()
    .nullable()
    .catch("")
    .transform((v) => v ?? ""),
  url: z.string(),
  title: z.string().nullable().catch(null),
  faviconUrl: z.string().nullable().catch(null),
  ogImageUrl: z.string().nullable().catch(null),
  createdAt: z.string().catch(""),
  note: z.string().nullable().catch(null),
  tags: z.array(z.string()).catch([]),
});

const canonicalExportSchema = z.object({
  // No top-level catch: a file without a workspaces array is not a
  // Sheltermark export. Per-workspace bookmark junk stays tolerated.
  workspaces: z.array(
    z.object({
      name: z.string(),
      bookmarks: z.array(bookmarkSchema).catch([]),
    }),
  ),
});

export function groupBookmarksByWorkspace(
  bookmarks: ExportBookmarkRow[],
): CanonicalExport["workspaces"] {
  const groups: Record<string, ExportBookmarkRow[]> = {};

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
      note: b.note,
      tags: b.tags,
    })),
  }));
}

export function buildCanonicalExport(
  rows: ExportBookmarkRow[],
  now = new Date(),
): CanonicalExport {
  return {
    version: "1.0",
    exportedAt: now.toISOString(),
    workspaces: groupBookmarksByWorkspace(rows),
  };
}

/**
 * Count of bookmarks in a canonical export — the round-trip sanity number
 * for backup restore previews.
 */
export function countBookmarksInExport(ex: CanonicalExport): number {
  return ex.workspaces.reduce((sum, ws) => sum + ws.bookmarks.length, 0);
}

/**
 * Narrow arbitrary JSON into the canonical export shape. Zod parses at the
 * I/O boundary; a null return means "not a Sheltermark export file".
 */
export function parseCanonicalExport(content: string): CanonicalExport | null {
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    return null;
  }
  const parsed = canonicalExportSchema.safeParse(data);
  if (!parsed.success) return null;

  return {
    version: "1.0",
    exportedAt: "",
    workspaces: parsed.data.workspaces,
  };
}
