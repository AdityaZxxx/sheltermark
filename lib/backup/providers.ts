import { z } from "zod";

import type { BackupProvider } from "~/lib/schemas/backup.schema";

import { BACKUP_FOLDER_PATH } from "~/lib/backup/naming";
import { logger } from "~/lib/utils/logger";

/**
 * Minimal per-provider REST adapters for Cloud Backup v1 (ADR-0008).
 * Operations needed: create the Sheltermark/Backups/ folder, list backups,
 * upload a backup file, download one for restore. No SDKs — plain fetch.
 *
 * Provider/API errors are logged server-side and surfaced as a single
 * generic message; raw provider payloads never reach the client.
 */

export interface BackupFileMeta {
  id: string;
  name: string;
  size: number | null;
  modifiedTime: string | null;
}

export interface ProviderClient {
  /**
   * Ensure the backups folder exists; returns its provider id/path.
   * `pinnedRef` is the previously resolved reference (Drive file id);
   * clients with stable paths (Dropbox/OneDrive) may ignore it.
   */
  ensureFolder(pinnedRef?: string): Promise<string>;
  listBackups(folderRef: string): Promise<BackupFileMeta[]>;
  uploadBackup(
    folderRef: string,
    filename: string,
    content: string,
  ): Promise<void>;
  /** Download a listed backup: Drive keys by id, path-based providers by name. */
  downloadBackup(file: BackupFileMeta): Promise<string | null>;
}

export function createProviderClient(
  provider: BackupProvider,
  accessToken: string,
): ProviderClient {
  if (provider === "google_drive") return new GoogleDriveClient(accessToken);
  if (provider === "dropbox") return new DropboxClient(accessToken);
  return new OneDriveClient(accessToken);
}

const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";

const driveFileListSchema = z.object({
  files: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        size: z.string().optional().catch(undefined),
        modifiedTime: z.string().optional().catch(undefined),
        mimeType: z.string().optional().catch(undefined),
      }),
    )
    .catch([]),
});

// Folder lookups ask Drive for files(id) — name is not in the payload,
// so validating it here would fail every lookup and mint duplicate
// folders. Keep this schema in sync with the fields= param.
const driveFolderListSchema = z.object({
  files: z.array(z.object({ id: z.string() })).catch([]),
});

const driveFileSchema = z.object({ id: z.string() });

class GoogleDriveClient implements ProviderClient {
  constructor(private accessToken: string) {}

  private async api<T>(
    schema: z.ZodType<T>,
    url: string,
    init?: RequestInit,
  ): Promise<T | null> {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        ...init?.headers,
      },
    });
    if (!response.ok) {
      logger.error("Google Drive backup API call failed", {
        module: url,
        status: response.status,
      });
      return null;
    }
    if (response.status === 204) return null;
    const parsed = schema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  }

  async ensureFolder(pinnedRef?: string): Promise<string> {
    // drive.file scope + repeated consents can leave duplicate
    // "Sheltermark" folders; the pinned id keeps every operation on the
    // same folder once one has been resolved.
    if (pinnedRef) {
      const pinned = await this.api(
        z.object({ id: z.string() }),
        `https://www.googleapis.com/drive/v3/files/${pinnedRef}?fields=id`,
      );
      if (pinned?.id) return pinned.id;
    }

    let parentId = "root";
    for (const segment of BACKUP_FOLDER_PATH) {
      const query = encodeURIComponent(
        `name='${segment}' and mimeType='${DRIVE_FOLDER_MIME}' and trashed=false and '${parentId}' in parents`,
      );
      const existing = await this.api(
        driveFolderListSchema,
        `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)&orderBy=createdTime desc`,
      );
      // With duplicates, files[0] is arbitrary; createdTime desc makes the
      // pick deterministic — newest is the one this app just wrote to.
      const found = existing?.files[0]?.id;
      if (found) {
        parentId = found;
        continue;
      }
      const created = await this.api(
        driveFileSchema,
        "https://www.googleapis.com/drive/v3/files",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: segment,
            mimeType: DRIVE_FOLDER_MIME,
            parents: [parentId],
          }),
        },
      );
      if (!created?.id) return "";
      parentId = created.id;
    }
    return parentId;
  }

  async listBackups(folderId: string): Promise<BackupFileMeta[]> {
    const query = encodeURIComponent(
      `'${folderId}' in parents and trashed=false`,
    );
    const payload = await this.api(
      driveFileListSchema,
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,size,modifiedTime)&orderBy=modifiedTime desc`,
    );
    // null = API/schema failure; an empty folder is a valid `{files: []}`.
    // Collapsing failure to [] makes the UI claim "No backups yet".
    if (!payload) throw new Error("list failed");
    return payload.files.map((f) => ({
      id: f.id,
      name: f.name,
      size: f.size !== undefined ? Number(f.size) : null,
      modifiedTime: f.modifiedTime ?? null,
    }));
  }

  async uploadBackup(
    folderId: string,
    filename: string,
    content: string,
  ): Promise<void> {
    // Drive's create endpoint never overwrites, so remove a same-named file
    // first — the daily filename means a re-backup replaces the day's file
    // (Dropbox `mode:"overwrite"` and OneDrive PUT already do this natively).
    const query = encodeURIComponent(
      `name='${filename}' and '${folderId}' in parents and trashed=false`,
    );
    const existing = await this.api(
      driveFolderListSchema,
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)`,
    );
    for (const file of existing?.files ?? []) {
      await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${this.accessToken}` },
      }).catch((cause: unknown) => {
        logger.error("Google Drive backup replace-delete failed", {
          error: cause,
        });
      });
    }

    // Multipart upload: metadata + JSON content in one request (backups are
    // well under the 5MB multipart limit for v1).
    const boundary = "sheltermark-backup";
    const body = [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify({ name: filename, parents: [folderId] }),
      `--${boundary}`,
      "Content-Type: application/json",
      "",
      content,
      `--${boundary}--`,
    ].join("\r\n");

    const response = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );
    if (!response.ok) {
      logger.error("Google Drive backup upload failed", {
        status: response.status,
      });
      throw new Error("upload failed");
    }
  }

  async downloadBackup(file: BackupFileMeta): Promise<string | null> {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } },
    );
    if (!response.ok) return null;
    return response.text();
  }
}

const dropboxListSchema = z.object({
  entries: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        size: z.number().optional().catch(undefined),
        server_modified: z.string().optional().catch(undefined),
      }),
    )
    .catch([]),
});

/** JSON body for Dropbox RPC-style endpoints (path, limit, …). */
interface DropboxRpcArgs {
  path: string;
  limit?: number;
}

class DropboxClient implements ProviderClient {
  constructor(private accessToken: string) {}

  private async rpc<T>(
    schema: z.ZodType<T>,
    endpoint: string,
    args: DropboxRpcArgs,
  ): Promise<T | null> {
    const response = await fetch(`https://api.dropboxapi.com/2/${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    if (!response.ok) {
      // 409 with conflict/folder is "folder exists" — expected on repeat
      // backups; everything else is a real failure.
      if (!(response.status === 409 && endpoint === "files/create_folder_v2")) {
        logger.error("Dropbox backup API call failed", {
          module: endpoint,
          status: response.status,
        });
      }
      return null;
    }
    const text = await response.text();
    if (!text) return null;
    const parsed = schema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  }

  async ensureFolder(_pinnedRef?: string): Promise<string> {
    const path = `/${BACKUP_FOLDER_PATH.join("/")}`;
    // create_folder_v2 creates intermediate folders; 409 = already exists,
    // the expected steady state for repeat backups.
    await this.rpc(z.object({}), "files/create_folder_v2", { path });
    return path;
  }

  async listBackups(_folderRef: string): Promise<BackupFileMeta[]> {
    const path = `/${BACKUP_FOLDER_PATH.join("/")}`;
    const payload = await this.rpc(dropboxListSchema, "files/list_folder", {
      path,
      limit: 100,
    });
    // null = API/schema failure; an empty folder is a valid `{entries: []}`.
    if (!payload) throw new Error("list failed");
    return payload.entries.map((e) => ({
      id: e.id,
      name: e.name,
      size: e.size ?? null,
      modifiedTime: e.server_modified ?? null,
    }));
  }

  async uploadBackup(
    _folderRef: string,
    filename: string,
    content: string,
  ): Promise<void> {
    const path = `/${BACKUP_FOLDER_PATH.join("/")}/${filename}`;
    const response = await fetch(
      "https://content.dropboxapi.com/2/files/upload",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/octet-stream",
          "Dropbox-API-Arg": JSON.stringify({
            path,
            mode: "overwrite",
            autorename: false,
          }),
        },
        body: content,
      },
    );
    if (!response.ok) {
      logger.error("Dropbox backup upload failed", { status: response.status });
      throw new Error("upload failed");
    }
  }

  async downloadBackup(file: BackupFileMeta): Promise<string | null> {
    const path = `/${BACKUP_FOLDER_PATH.join("/")}/${file.name}`;
    const response = await fetch(
      "https://content.dropboxapi.com/2/files/download",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Dropbox-API-Arg": JSON.stringify({ path }),
        },
      },
    );
    if (!response.ok) return null;
    return response.text();
  }
}

// OneDrive (Microsoft Graph, personal accounts via /common)

const oneDriveItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.number().optional().catch(undefined),
  lastModifiedDateTime: z.string().optional().catch(undefined),
});

const oneDriveChildrenSchema = z.object({
  value: z.array(oneDriveItemSchema).catch([]),
});

class OneDriveClient implements ProviderClient {
  constructor(private accessToken: string) {}

  private async graph<T>(
    schema: z.ZodType<T>,
    pathAndQuery: string,
    init?: RequestInit,
  ): Promise<T | null> {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0${pathAndQuery}`,
      {
        ...init,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          ...init?.headers,
        },
      },
    );
    if (!response.ok) {
      logger.error("OneDrive backup API call failed", {
        module: pathAndQuery,
        status: response.status,
      });
      return null;
    }
    const text = await response.text();
    if (!text) return null;
    const parsed = schema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  }

  async ensureFolder(_pinnedRef?: string): Promise<string> {
    // Graph has no mkdir -p: walk segment by segment, creating each level.
    let currentPath = "";
    for (const segment of BACKUP_FOLDER_PATH) {
      const nextPath = `${currentPath}/${segment}`;
      const existing = await this.graph(
        oneDriveItemSchema,
        `/me/drive/root:${nextPath}`,
      );
      if (existing?.id) {
        currentPath = nextPath;
        continue;
      }
      const created = await this.graph(
        oneDriveItemSchema,
        `/me/drive/root${currentPath === "" ? "" : `:${currentPath}`}:/children`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: segment,
            folder: {},
            "@microsoft.graph.conflictBehavior": "fail",
          }),
        },
      );
      if (!created?.id) return "";
      currentPath = nextPath;
    }
    return currentPath;
  }

  async listBackups(folderPath: string): Promise<BackupFileMeta[]> {
    const payload = await this.graph(
      oneDriveChildrenSchema,
      `/me/drive/root:${folderPath}:/children`,
    );
    // null = API/schema failure; an empty folder is a valid `{value: []}`.
    if (!payload) throw new Error("list failed");
    return payload.value.map((i) => ({
      id: i.id,
      name: i.name,
      size: i.size ?? null,
      modifiedTime: i.lastModifiedDateTime ?? null,
    }));
  }

  async uploadBackup(
    folderPath: string,
    filename: string,
    content: string,
  ): Promise<void> {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/root:${folderPath}/${filename}:/content`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: content,
      },
    );
    if (!response.ok) {
      logger.error("OneDrive backup upload failed", {
        status: response.status,
      });
      throw new Error("upload failed");
    }
  }

  async downloadBackup(file: BackupFileMeta): Promise<string | null> {
    // Graph content endpoints answer 302 to a pre-authenticated URL;
    // fetch follows redirects by default, so the plain GET returns content.
    // Id-keyed URL: works for any folder the item lives in.
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${file.id}/content`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } },
    );
    if (!response.ok) return null;
    return response.text();
  }
}
