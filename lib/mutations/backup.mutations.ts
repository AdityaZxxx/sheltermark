import type { QueryKey } from "@tanstack/react-query";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { BackupProvider } from "~/lib/schemas/backup.schema";

import {
  backupNow,
  disconnectProvider,
  previewBackupRestore,
  restoreFromBackup,
} from "~/app/action/backup.action";
import { useUser } from "~/components/providers/user-context";
import { GENERIC_ERROR } from "~/lib/action-result";
import {
  backupKeys,
  bookmarkKeys,
  tagKeys,
  workspaceKeys,
} from "~/lib/query-keys";

function invalidatesAllFor(userId: string): readonly QueryKey[] {
  return [
    backupKeys.all(userId),
    bookmarkKeys.all(userId),
    workspaceKeys.all(userId),
    tagKeys.all(userId),
  ];
}

export function useBackupNow() {
  const queryClient = useQueryClient();
  const userId = useUser().id;
  return useMutation({
    mutationFn: async () => {
      const result = await backupNow();
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      toast.success("Backup complete");
      for (const key of invalidatesAllFor(userId)) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || GENERIC_ERROR);
    },
  });
}

export function useDisconnectProvider() {
  const queryClient = useQueryClient();
  const userId = useUser().id;
  return useMutation({
    mutationFn: async (provider: BackupProvider) => {
      const result = await disconnectProvider(provider);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      toast.success("Provider disconnected");
      queryClient.invalidateQueries({ queryKey: backupKeys.all(userId) });
    },
    onError: (error: Error) => {
      toast.error(error.message || GENERIC_ERROR);
    },
  });
}

export function usePreviewRestore() {
  return useMutation({
    mutationFn: async (fileId: string) => {
      const result = await previewBackupRestore(fileId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onError: (error: Error) => {
      toast.error(error.message || GENERIC_ERROR);
    },
  });
}

export function useRestoreBackup() {
  const queryClient = useQueryClient();
  const userId = useUser().id;
  return useMutation({
    mutationFn: async (input: {
      fileId: string;
      duplicateStrategy: "skip" | "replace";
    }) => {
      const result = await restoreFromBackup(input);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (data) => {
      if (data.errors.length > 0) {
        toast.warning(`Restore finished with ${data.errors.length} issues`);
      } else {
        toast.success(`Restored ${data.imported} bookmarks`);
      }
      for (const key of invalidatesAllFor(userId)) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || GENERIC_ERROR);
    },
  });
}
