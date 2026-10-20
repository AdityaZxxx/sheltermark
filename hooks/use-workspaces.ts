"use client";

import { useQuery } from "@tanstack/react-query";
import { useContext } from "react";

import { UserContext } from "~/components/providers/user-context";
import { useWorkspaceNavigation } from "~/hooks/use-workspace-navigation";
import {
  useCreateWorkspace,
  useDeleteWorkspace,
  useRenameWorkspace,
  useSetDefaultWorkspace,
  useToggleAutoCheckWorkspace,
  useTogglePublicWorkspace,
  useTouchWorkspaceLastUsed,
} from "~/lib/mutations/workspace.mutations";
import { workspacesQueryOptions } from "~/lib/queries/workspace.queries";

// Last-used tracking is non-critical, but still needs to run if the tab
// never reaches an idle state before the user leaves.
const LAST_USED_IDLE_TIMEOUT_MS = 2_000;

export function useWorkspaces() {
  const serverUser = useContext(UserContext);
  const userId = serverUser?.id ?? "";
  const isAuthed = Boolean(serverUser);
  const { isWorkspaceRoute, workspaceIdParam, goToWorkspace } =
    useWorkspaceNavigation();

  const { data: workspaces = [], isLoading: isWsLoading } = useQuery({
    ...workspacesQueryOptions(userId),
    enabled: isAuthed,
  });

  const currentWorkspace =
    workspaces.length === 0 || !workspaceIdParam
      ? null
      : workspaces.find((ws) => ws.id === workspaceIdParam) ||
        workspaces.find((ws) => ws.is_default) ||
        workspaces[0];

  const touch = useTouchWorkspaceLastUsed(userId);

  const setActiveWorkspace = (id: string) => {
    goToWorkspace(id);
    requestIdleCallback(() => touch.mutate(id), {
      timeout: LAST_USED_IDLE_TIMEOUT_MS,
    });
  };

  const clearActiveWorkspace = () => {
    goToWorkspace(null);
  };

  const create = useCreateWorkspace(userId);
  const del = useDeleteWorkspace(userId);
  const rename = useRenameWorkspace(userId);
  const setDefault = useSetDefaultWorkspace(userId);
  const togglePublic = useTogglePublicWorkspace(userId);
  const toggleAutoCheck = useToggleAutoCheckWorkspace(userId);

  const deleteWorkspace = (id: string) => {
    const wasActive = id === workspaceIdParam;
    del.mutate(id, {
      onSuccess: () => {
        if (!wasActive) return;
        const fallback =
          workspaces.find((w) => w.is_default && w.id !== id) ??
          workspaces.find((w) => w.id !== id);
        goToWorkspace(fallback?.id ?? null);
      },
    });
  };

  return {
    workspaces,
    currentWorkspace,
    isLoading: isWsLoading,
    isWorkspaceRoute,
    setActiveWorkspace,
    clearActiveWorkspace,
    createWorkspace: create.mutate,
    isCreating: create.isPending,
    deleteWorkspace,
    isDeleting: del.isPending,
    togglePublicStatus: togglePublic.mutate,
    isTogglingPublic: togglePublic.isPending,
    setDefaultWorkspace: setDefault.mutate,
    isSettingDefault: setDefault.isPending,
    toggleAutoCheckBroken: toggleAutoCheck.mutate,
    isTogglingAutoCheck: toggleAutoCheck.isPending,
    renameWorkspace: rename.mutate,
    isRenaming: rename.isPending,
  };
}
