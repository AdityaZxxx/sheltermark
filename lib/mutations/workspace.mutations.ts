import {
  createWorkspace,
  deleteWorkspace,
  renameWorkspace,
  setDefaultWorkspace,
  toggleAutoCheckBroken,
  togglePublicStatus,
} from "~/app/action/workspace.action";
import { useOptimisticMutation } from "~/lib/mutations/base";
import { trashKeys, workspaceKeys } from "~/lib/query-keys";
import type { WorkspaceWithCount } from "~/lib/schemas/workspace.schema";

const generateTempId = () =>
  `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export function useCreateWorkspace(userId: string | undefined) {
  return useOptimisticMutation<FormData, { id: string }>({
    mutationFn: createWorkspace,
    queryKey: workspaceKeys.byUser(userId),
    successMessage: "Workspace created",
    errorMessage: "Failed to create workspace",
    prepareOptimisticData: (oldData, formData) => {
      const prev = oldData as WorkspaceWithCount[];
      const name = (formData.get("name") as string) ?? "";
      return [
        ...prev,
        {
          id: generateTempId(),
          name,
          is_public: false,
          is_default: prev.length === 0,
          auto_check_broken: false,
          bookmarks_count: 0,
          user_id: userId ?? "",
          created_at: new Date().toISOString(),
          updated_at: null,
          deleted_at: null,
        } satisfies WorkspaceWithCount,
      ];
    },
  });
}

export function useDeleteWorkspace(userId: string | undefined) {
  return useOptimisticMutation<string, null>({
    mutationFn: deleteWorkspace,
    queryKey: workspaceKeys.byUser(userId),
    dependentQueryKeys: [trashKeys.all],
    successMessage: "Workspace moved to trash",
    errorMessage: "Failed to delete workspace",
    prepareOptimisticData: (oldData, id) => {
      const prev = oldData as WorkspaceWithCount[];
      return prev.filter((ws) => ws.id !== id);
    },
  });
}

export function useRenameWorkspace(userId: string | undefined) {
  return useOptimisticMutation<{ id: string; name: string }, null>({
    mutationFn: ({ id, name }) => renameWorkspace(id, name),
    queryKey: workspaceKeys.byUser(userId),
    successMessage: "Workspace renamed",
    errorMessage: "Failed to rename workspace",
    prepareOptimisticData: (oldData, { id, name }) => {
      const prev = oldData as WorkspaceWithCount[];
      return prev.map((ws) => (ws.id === id ? { ...ws, name } : ws));
    },
  });
}

export function useSetDefaultWorkspace(userId: string | undefined) {
  return useOptimisticMutation<string, null>({
    mutationFn: setDefaultWorkspace,
    queryKey: workspaceKeys.byUser(userId),
    successMessage: "Default workspace updated",
    errorMessage: "Failed to set default workspace",
    prepareOptimisticData: (oldData, id) => {
      const prev = oldData as WorkspaceWithCount[];
      return prev.map((ws) => ({ ...ws, is_default: ws.id === id }));
    },
  });
}

export function useTogglePublicWorkspace(userId: string | undefined) {
  return useOptimisticMutation<{ id: string; isPublic: boolean }, null>({
    mutationFn: ({ id, isPublic }) => togglePublicStatus(id, isPublic),
    queryKey: workspaceKeys.byUser(userId),
    successMessage: "Workspace visibility toggled",
    errorMessage: "Failed to toggle visibility",
    prepareOptimisticData: (oldData, { id, isPublic }) => {
      const prev = oldData as WorkspaceWithCount[];
      return prev.map((ws) =>
        ws.id === id ? { ...ws, is_public: isPublic } : ws,
      );
    },
  });
}

export function useToggleAutoCheckWorkspace(userId: string | undefined) {
  return useOptimisticMutation<{ id: string; enabled: boolean }, null>({
    mutationFn: ({ id, enabled }) => toggleAutoCheckBroken(id, enabled),
    queryKey: workspaceKeys.byUser(userId),
    successMessage: "Auto-check updated",
    errorMessage: "Failed to toggle auto check",
    prepareOptimisticData: (oldData, { id, enabled }) => {
      const prev = oldData as WorkspaceWithCount[];
      return prev.map((ws) =>
        ws.id === id ? { ...ws, auto_check_broken: enabled } : ws,
      );
    },
  });
}
