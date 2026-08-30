import { useQuery } from "@tanstack/react-query";

import type { BackupFileMeta } from "~/lib/backup/service";

import {
  getCloudBackupStatus,
  listProviderBackups,
  type CloudBackupStatus,
} from "~/app/action/backup.action";
import { useUser } from "~/components/providers/user-context";
import { backupKeys } from "~/lib/query-keys";

/** Connection status: provider, account email, last backup time/outcome. */
export function useCloudBackupStatus() {
  const userId = useUser().id;
  return useQuery({
    queryKey: backupKeys.status(userId),
    queryFn: async (): Promise<CloudBackupStatus[]> => {
      const result = await getCloudBackupStatus();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });
}

/** Backup files in the connected provider's Sheltermark/Backups/ folder. */
export function useBackupFiles(enabled: boolean) {
  const userId = useUser().id;
  return useQuery({
    queryKey: backupKeys.files(userId),
    enabled,
    queryFn: async (): Promise<BackupFileMeta[]> => {
      const result = await listProviderBackups();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });
}
