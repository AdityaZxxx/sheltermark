import { z } from "zod";

/**
 * Cloud Backup v1 providers (ADR-0008). Parity with Raindrop's backup
 * targets: Google Drive, Dropbox, OneDrive.
 */
export const backupProviderSchema = z.enum([
  "google_drive",
  "dropbox",
  "onedrive",
]);

export type BackupProvider = z.infer<typeof backupProviderSchema>;

export const restoreOptionsSchema = z.object({
  fileId: z.string().min(1),
  duplicateStrategy: z.enum(["skip", "replace"]),
});
