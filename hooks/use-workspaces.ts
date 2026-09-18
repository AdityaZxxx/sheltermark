"use client";

import { useQuery } from "@tanstack/react-query";
import { createParser, useQueryState } from "nuqs";
import { useContext } from "react";

import { UserContext } from "~/components/providers/user-context";
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
import { uuidSchema } from "~/lib/schemas/common";

// Last-used tracking is non-critical, but still needs to run if the tab
// never reaches an idle state before the user leaves.
const LAST_USED_IDLE_TIMEOUT_MS = 2_000;

const workspaceIdParamParser = createParser({
  parse: (value) => (uuidSchema.safeParse(value).success ? value : null),
  serialize: (value) => value,
}).withOptions({ shallow: true });

export function useWorkspaceIdParam() {
  return useQueryState("workspaceId", workspaceIdParamParser);
}

export function useWorkspaces() {
  const serverUser = useContext(UserContext);
  const userId = serverUser?.id ?? "";
  const isAuthed = Boolean(serverUser);
  const [workspaceIdParam, setWorkspaceIdParam] = useWorkspaceIdParam();

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
    setWorkspaceIdParam(id);
    requestIdleCallback(() => touch.mutate(id), {
      timeout: LAST_USED_IDLE_TIMEOUT_MS,
    });
  };

  const clearActiveWorkspace = () => {
    setWorkspaceIdParam(null);
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
        setWorkspaceIdParam(fallback?.id ?? null);
      },
    });
  };

  return {
    workspaces,
    currentWorkspace,
    isLoading: isWsLoading,
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
