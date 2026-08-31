import "server-only";
import type { ActionResult } from "~/lib/action-result";
import type { DrizzleDb } from "~/lib/data/db";
import type { CloudConnectionRow } from "~/lib/data/repositories/cloud-connection.repository";

import { GENERIC_ERROR } from "~/lib/action-result";
import { backupFilename } from "~/lib/backup/naming";
import {
  batchInsertBookmarks,
  exportBookmarksForBackup,
} from "~/lib/data/repositories/bookmark.repository";
import {
  setProviderFolderId,
  updateConnectionTokens,
} from "~/lib/data/repositories/cloud-connection.repository";
import {
  createWorkspaceRaw,
  findWorkspaceIdByName,
} from "~/lib/data/repositories/workspace.repository";
import {
  buildCanonicalExport,
  parseCanonicalExport,
} from "~/lib/import/export-json";
import { parseImportFile, type ParsedBookmark } from "~/lib/import/parsers";
import { logger } from "~/lib/utils/logger";

import { refreshAccessToken } from "./oauth";
import {
  createProviderClient,
  type BackupFileMeta,
  type ProviderClient,
} from "./providers";

export type { BackupFileMeta };
export type { CloudConnectionRow };

/**
 * Get a usable access token: refresh when expired, persisting rotated
 * tokens. A dead grant returns null so callers surface "reconnect" instead
 * of a raw provider error.
 */
async function ensureFreshToken(
  db: DrizzleDb,
  connection: CloudConnectionRow,
): Promise<string | null> {
  const expired =
    connection.token_expires_at !== null &&
    new Date(connection.token_expires_at).getTime() - Date.now() < 60_000;

  if (!expired) return connection.access_token;

  if (!connection.refresh_token) {
    logger.warn("Cloud backup token expired without refresh token", {
      provider: connection.provider,
    });
    return null;
  }

  const refreshed = await refreshAccessToken(
    connection.provider,
    connection.refresh_token,
  );
  if (!refreshed) {
    logger.warn("Cloud backup token refresh rejected", {
      provider: connection.provider,
    });
    return null;
  }

  const updated = await updateConnectionTokens(
    db,
    connection.user_id,
    connection.provider,
    {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      tokenExpiresAt: refreshed.expiresAt,
    },
  );
  if (!updated.success) return null;
  return refreshed.accessToken;
}

interface BackupOutcome {
  filename: string;
  bookmarkCount: number;
}

/**
 * Resolve the backups folder via the client, passing the pinned ref and
 * persisting a new resolution (Drive: duplicate consents can mint new
 * folders; the pin keeps later operations on the same one).
 */
async function ensurePinnedFolder(
  db: DrizzleDb,
  connection: CloudConnectionRow,
  client: ProviderClient,
): Promise<string> {
  const folderRef = await client.ensureFolder(
    connection.provider_folder_id ?? undefined,
  );
  if (folderRef && folderRef !== connection.provider_folder_id) {
    const pinned = await setProviderFolderId(
      db,
      connection.user_id,
      connection.provider,
      folderRef,
    );
    if (pinned.success) connection.provider_folder_id = folderRef;
  }
  return folderRef;
}

/** Serialize + upload a backup. Provider errors collapse to GENERIC_ERROR. */
export async function runBackup(
  db: DrizzleDb,
  connection: CloudConnectionRow,
): Promise<ActionResult<BackupOutcome>> {
  const token = await ensureFreshToken(db, connection);
  if (!token) {
    return {
      success: false,
      error: "Connection expired. Reconnect to continue.",
    };
  }

  const rowsResult = await exportBookmarksForBackup(db, connection.user_id);
  if (!rowsResult.success) return rowsResult;

  const exportData = buildCanonicalExport(rowsResult.data);
  const filename = backupFilename();
  const content = JSON.stringify(exportData, null, 2);

  const client = createProviderClient(connection.provider, token);
  try {
    const folderRef = await ensurePinnedFolder(db, connection, client);
    if (!folderRef) {
      return { success: false, error: GENERIC_ERROR };
    }
    await client.uploadBackup(folderRef, filename, content);

    return {
      success: true,
      data: {
        filename,
        bookmarkCount: exportData.workspaces.reduce(
          (sum, ws) => sum + ws.bookmarks.length,
          0,
        ),
      },
    };
  } catch (cause) {
    logger.error("Cloud backup upload failed", {
      error: cause,
      provider: connection.provider,
    });
    return { success: false, error: GENERIC_ERROR };
  }
}

export async function listBackups(
  db: DrizzleDb,
  connection: CloudConnectionRow,
): Promise<ActionResult<BackupFileMeta[]>> {
  const token = await ensureFreshToken(db, connection);
  if (!token) {
    return {
      success: false,
      error: "Connection expired. Reconnect to continue.",
    };
  }
  const client = createProviderClient(connection.provider, token);
  try {
    const folderRef = await ensurePinnedFolder(db, connection, client);
    if (!folderRef) return { success: false, error: GENERIC_ERROR };
    const files = await client.listBackups(folderRef);
    // Newer first; providers don't guarantee ordering across pagination.
    return {
      success: true,
      data: files.toSorted((a, b) =>
        (b.modifiedTime ?? "").localeCompare(a.modifiedTime ?? ""),
      ),
    };
  } catch (cause) {
    logger.error("Cloud backup list failed", {
      error: cause,
      provider: connection.provider,
    });
    return { success: false, error: GENERIC_ERROR };
  }
}

export interface RestorePreview {
  backupName: string;
  workspaces: { name: string; count: number }[];
  totalBookmarks: number;
}

/** Download + parse a backup file without touching any data. */
export async function previewRestore(
  db: DrizzleDb,
  connection: CloudConnectionRow,
  fileId: string,
): Promise<ActionResult<RestorePreview>> {
  const token = await ensureFreshToken(db, connection);
  if (!token) {
    return {
      success: false,
      error: "Connection expired. Reconnect to continue.",
    };
  }

  const client = createProviderClient(connection.provider, token);
  const file = await findBackupFile(db, connection, client, fileId);
  if (!file) return { success: false, error: "Backup file not found." };

  let content: string | null = null;
  try {
    content = await client.downloadBackup(file);
  } catch (cause) {
    logger.error("Cloud backup download failed", {
      error: cause,
      provider: connection.provider,
    });
    return { success: false, error: GENERIC_ERROR };
  }
  if (!content) {
    return { success: false, error: "Backup file not found." };
  }

  const canonical = parseCanonicalExport(content);
  if (!canonical) {
    return { success: false, error: "This backup file is not valid." };
  }

  const counts = new Map<string, number>();
  let total = 0;
  for (const ws of canonical.workspaces) {
    const count = ws.bookmarks.length;
    counts.set(ws.name, (counts.get(ws.name) ?? 0) + count);
    total += count;
  }

  return {
    success: true,
    data: {
      backupName: file.name,
      workspaces: [...counts.entries()].map(([name, count]) => ({
        name,
        count,
      })),
      totalBookmarks: total,
    },
  };
}

export interface RestoreResult {
  imported: number;
  skipped: number;
  errors: string[];
}

/**
 * Restore a backup by downloading it and running it through the EXISTING
 * import pipeline (parseImportFile + batchInsertBookmarks). The preview step
 * is the confirmation gate before this runs; "replace" deletes matching
 * current bookmarks per the import pipeline's semantics.
 */
export async function restoreBackup(
  db: DrizzleDb,
  connection: CloudConnectionRow,
  fileId: string,
  options: {
    duplicateStrategy: "skip" | "replace";
    targetWorkspaceId?: string | null;
  },
): Promise<ActionResult<RestoreResult>> {
  const token = await ensureFreshToken(db, connection);
  if (!token) {
    return {
      success: false,
      error: "Connection expired. Reconnect to continue.",
    };
  }

  const client = createProviderClient(connection.provider, token);
  const file = await findBackupFile(db, connection, client, fileId);
  if (!file) {
    return { success: false, error: "Backup file not found." };
  }

  let content: string | null = null;
  try {
    content = await client.downloadBackup(file);
  } catch (cause) {
    logger.error("Cloud backup download failed", {
      error: cause,
      provider: connection.provider,
    });
    return { success: false, error: GENERIC_ERROR };
  }
  if (!content) {
    return { success: false, error: "Backup file not found." };
  }

  const parsed = parseImportFile(content, "json");
  if (!parsed.success) {
    return { success: false, error: "This backup file is not valid." };
  }

  // Group by source workspace name so bookmarks land in equivalently named
  // workspaces (created when missing), mirroring JSON import behavior.
  const byWorkspace = new Map<string, ParsedBookmark[]>();
  for (const bm of parsed.bookmarks) {
    const name = bm.workspaceName ?? "Imported - Backup";
    const list = byWorkspace.get(name);
    if (list) {
      list.push(bm);
    } else {
      byWorkspace.set(name, [bm]);
    }
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const [wsName, items] of byWorkspace) {
    let targetWorkspaceId = options.targetWorkspaceId ?? null;

    if (!targetWorkspaceId) {
      const existing = await findWorkspaceIdByName(
        db,
        connection.user_id,
        wsName,
      );
      if (existing) {
        targetWorkspaceId = existing;
      } else {
        const created = await createWorkspaceRaw(
          db,
          connection.user_id,
          wsName,
        );
        if (!created.success) {
          errors.push(`Failed to restore workspace ${wsName}`);
          continue;
        }
        targetWorkspaceId = created.data.id;
      }
    }

    const result = await batchInsertBookmarks(
      db,
      connection.user_id,
      targetWorkspaceId,
      items,
      { duplicateStrategy: options.duplicateStrategy, linkTags: true },
    );
    if (result.success) {
      imported += result.data.imported;
      skipped += result.data.skipped;
      errors.push(...result.data.errors);
    } else {
      errors.push(`Failed to restore workspace ${wsName}`);
    }
  }

  return { success: true, data: { imported, skipped, errors } };
}

/**
 * Resolve a listed backup id to its file meta. Listing (rather than a
 * direct id fetch) proves the file lives in the Sheltermark/Backups/
 * folder, so a forged file id can't pull arbitrary provider files into
 * the restore pipeline.
 */
async function findBackupFile(
  db: DrizzleDb,
  connection: CloudConnectionRow,
  client: ProviderClient,
  fileId: string,
): Promise<BackupFileMeta | null> {
  const folderRef = await ensurePinnedFolder(db, connection, client);
  if (!folderRef) return null;
  const files = await client.listBackups(folderRef);
  return files.find((f) => f.id === fileId) ?? null;
}
