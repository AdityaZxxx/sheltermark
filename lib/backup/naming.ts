/**
 * Cloud Backup file placement (ADR-0008): a dedicated folder in the user's
 * own storage, one file per calendar day, overwritten on re-run.
 */

/** Folder path dedicated to backups, where the provider supports folders. */
export const BACKUP_FOLDER_PATH = ["Sheltermark", "Backups"] as const;

/** Backup file name inside the folder: one per calendar day. */
export function backupFilename(date = new Date()): string {
  return `sheltermark-backup-${date.toISOString().slice(0, 10)}.json`;
}
