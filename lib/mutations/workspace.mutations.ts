import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { WorkspaceWithCount } from "~/lib/schemas/workspace.schema";

import {
  createWorkspace,
  deleteWorkspace,
  renameWorkspace,
  setDefaultWorkspace,
  toggleAutoCheckBroken,
  togglePublicStatus,
  touchWorkspaceLastUsed,
} from "~/app/action/workspace.action";
import {
  optimisticAppend,
  optimisticRemove,
  optimisticUpdate,
  useOptimisticMutation,
} from "~/lib/mutations/base";
import { trashKeys, workspaceKeys } from "~/lib/query-keys";

const generateTempId = () =>
  `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export function useCreateWorkspace(userId: string) {
  return useOptimisticMutation<FormData, { id: string }, WorkspaceWithCount[]>({
    mutationFn: createWorkspace,
    queryKey: workspaceKeys.all(userId),
    successMessage: "Workspace created",
    errorMessage: "Failed to create workspace",
    prepareOptimisticData: (oldData, formData) => {
      const name = formData.get("name")?.toString() ?? "";
      const prev = oldData ?? [];
      return optimisticAppend(prev, {
        id: generateTempId(),
        name,
        is_public: false,
        is_default: prev.length === 0,
        auto_check_broken: false,
        bookmarks_count: 0,
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: null,
        last_used_at: null,
        deleted_at: null,
      });
    },
  });
}

export function useDeleteWorkspace(userId: string) {
  return useOptimisticMutation<string, null, WorkspaceWithCount[]>({
    mutationFn: deleteWorkspace,
    queryKey: workspaceKeys.all(userId),
    dependentQueryKeys: [trashKeys.all(userId)],
    successMessage: "Workspace moved to trash",
    errorMessage: "Failed to delete workspace",
    prepareOptimisticData: (oldData, id) => {
      return optimisticRemove(oldData, id);
    },
  });
}

export function useRenameWorkspace(userId: string) {
  return useOptimisticMutation<
    { id: string; name: string },
    null,
    WorkspaceWithCount[]
  >({
    mutationFn: ({ id, name }) => renameWorkspace(id, name),
    queryKey: workspaceKeys.all(userId),
    successMessage: "Workspace renamed",
    errorMessage: "Failed to rename workspace",
    prepareOptimisticData: (oldData, { id, name }) => {
      return optimisticUpdate(oldData, id, (ws) => ({
        ...ws,
        name,
      }));
    },
  });
}

export function useSetDefaultWorkspace(userId: string) {
  return useOptimisticMutation<string, null, WorkspaceWithCount[]>({
    mutationFn: setDefaultWorkspace,
    queryKey: workspaceKeys.all(userId),
    successMessage: "Default workspace updated",
    errorMessage: "Failed to set default workspace",
    prepareOptimisticData: (oldData, id) => {
      const prev = oldData ?? [];
      return prev.map((ws) => ({ ...ws, is_default: ws.id === id }));
    },
  });
}

export function useTogglePublicWorkspace(userId: string) {
  return useOptimisticMutation<
    { id: string; isPublic: boolean },
    null,
    WorkspaceWithCount[]
  >({
    mutationFn: ({ id, isPublic }) => togglePublicStatus(id, isPublic),
    queryKey: workspaceKeys.all(userId),
    successMessage: "Workspace visibility toggled",
    errorMessage: "Failed to toggle visibility",
    prepareOptimisticData: (oldData, { id, isPublic }) => {
      return optimisticUpdate(oldData, id, (ws) => ({
        ...ws,
        is_public: isPublic,
      }));
    },
  });
}

export function useToggleAutoCheckWorkspace(userId: string) {
  return useOptimisticMutation<
    { id: string; enabled: boolean },
    null,
    WorkspaceWithCount[]
  >({
    mutationFn: ({ id, enabled }) => toggleAutoCheckBroken(id, enabled),
    queryKey: workspaceKeys.all(userId),
    successMessage: "Auto-check updated",
    errorMessage: "Failed to toggle auto check",
    prepareOptimisticData: (oldData, { id, enabled }) => {
      return optimisticUpdate(oldData, id, (ws) => ({
        ...ws,
        auto_check_broken: enabled,
      }));
    },
  });
}

export function useTouchWorkspaceLastUsed(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: touchWorkspaceLastUsed,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.all(userId),
        refetchType: "none",
      });
    },
  });
}
