"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

import { useSupabase } from "~/components/providers/supabase-provider";
import { useUser } from "~/components/providers/user-context";
import {
  useCreateWorkspace,
  useDeleteWorkspace,
  useRenameWorkspace,
  useSetDefaultWorkspace,
  useToggleAutoCheckWorkspace,
  useTogglePublicWorkspace,
} from "~/lib/mutations/workspace.mutations";
import { workspacesQueryOptions } from "~/lib/queries/workspace.queries";

export function useWorkspaces() {
  const pathname = usePathname();
  const router = useRouter();
  const { user: supabaseUser, isLoading: isAuthLoading } = useSupabase();
  const serverUser = useUser();
  const userId = serverUser?.id ?? supabaseUser?.id;

  const { data: workspaces = [], isLoading: isWsLoading } = useQuery(
    workspacesQueryOptions(userId),
  );

  const routeWorkspaceId = useMemo(() => {
    const match = pathname.match(/^\/workspace\/([^/]+)$/);
    return match ? match[1] : null;
  }, [pathname]);

  const currentWorkspace = useMemo(() => {
    if (workspaces.length === 0) return null;
    if (!routeWorkspaceId) return null;
    return (
      workspaces.find((ws) => ws.id === routeWorkspaceId) ||
      workspaces.find((ws) => ws.is_default) ||
      workspaces[0]
    );
  }, [workspaces, routeWorkspaceId]);

  const setActiveWorkspace = useCallback(
    (id: string) => {
      router.push(`/workspace/${id}`);
    },
    [router],
  );

  const clearActiveWorkspace = useCallback(() => {
    router.push("/dashboard");
  }, [router]);

  const create = useCreateWorkspace(userId);
  const del = useDeleteWorkspace(userId);
  const rename = useRenameWorkspace(userId);
  const setDefault = useSetDefaultWorkspace(userId);
  const togglePublic = useTogglePublicWorkspace(userId);
  const toggleAutoCheck = useToggleAutoCheckWorkspace(userId);

  return {
    workspaces,
    currentWorkspace,
    isLoading: isAuthLoading || isWsLoading,
    setActiveWorkspace,
    clearActiveWorkspace,
    createWorkspace: create.mutate,
    isCreating: create.isPending,
    deleteWorkspace: del.mutate,
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
