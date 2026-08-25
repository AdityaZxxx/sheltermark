"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";

import { useUser } from "~/components/providers/user-context";
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
import { workspaceKeys } from "~/lib/query-keys";

export function useWorkspaces() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const serverUser = useUser();
  const userId = serverUser.id;

  const { data: workspaces = [], isLoading: isWsLoading } = useQuery(
    workspacesQueryOptions(userId),
  );

  const routeWorkspaceId =
    pathname.match(/^\/workspace\/([^/]+)$/)?.[1] ?? null;

  const currentWorkspace =
    workspaces.length === 0 || !routeWorkspaceId
      ? null
      : workspaces.find((ws) => ws.id === routeWorkspaceId) ||
        workspaces.find((ws) => ws.is_default) ||
        workspaces[0];

  const touch = useTouchWorkspaceLastUsed(userId);

  const refetchWorkspaces = () => {
    void queryClient.refetchQueries({
      queryKey: workspaceKeys.all(userId),
      type: "active",
    });
  };

  const setActiveWorkspace = (id: string) => {
    touch.mutate(id);
    router.push(`/workspace/${id}`);
  };

  const clearActiveWorkspace = () => {
    router.push("/dashboard");
  };

  const create = useCreateWorkspace(userId);
  const del = useDeleteWorkspace(userId);
  const rename = useRenameWorkspace(userId);
  const setDefault = useSetDefaultWorkspace(userId);
  const togglePublic = useTogglePublicWorkspace(userId);
  const toggleAutoCheck = useToggleAutoCheckWorkspace(userId);

  const deleteWorkspace = (id: string) => {
    const wasActive = id === routeWorkspaceId;
    del.mutate(id, {
      onSuccess: () => {
        if (!wasActive) return;
        const fallback =
          workspaces.find((w) => w.is_default && w.id !== id) ??
          workspaces.find((w) => w.id !== id);
        router.push(fallback ? `/workspace/${fallback.id}` : "/dashboard");
      },
    });
  };

  return {
    workspaces,
    currentWorkspace,
    isLoading: isWsLoading,
    setActiveWorkspace,
    clearActiveWorkspace,
    refetchWorkspaces,
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
