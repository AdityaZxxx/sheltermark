"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  createWorkspace,
  deleteWorkspace,
  getWorkspaces,
  renameWorkspace,
  setDefaultWorkspace,
  toggleAutoCheckBroken,
  togglePublicStatus,
} from "~/app/action/workspace";
import { useSupabase } from "~/components/providers/supabase-provider";
import { workspaceKeys } from "~/lib/query-keys";
import type { WorkspaceWithCount } from "~/lib/schemas/workspace";

const generateTempId = () =>
  `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const workspacesQueryOptions = (userId: string | undefined) => ({
  queryKey: workspaceKeys.byUser(userId),
  queryFn: getWorkspaces,
  enabled: !!userId,
  staleTime: 1000 * 60 * 5,
  gcTime: 1000 * 60 * 30,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
});

export function useWorkspaces() {
  const queryClient = useQueryClient();
  const [activeWorkspaceId, setActiveWorkspaceId] = useQueryState("workspace");
  const { user, isLoading: isAuthLoading } = useSupabase();

  const queryKey = useMemo(() => workspaceKeys.byUser(user?.id), [user?.id]);

  const { data: workspaces = [], isLoading: isWsLoading } = useQuery<
    WorkspaceWithCount[]
  >(workspacesQueryOptions(user?.id));

  const currentWorkspace = useMemo(() => {
    if (workspaces.length === 0) return null;

    if (!activeWorkspaceId) {
      return workspaces.find((ws) => ws.is_default) || workspaces[0];
    }
    return (
      workspaces.find((ws) => ws.id === activeWorkspaceId) ||
      workspaces.find((ws) => ws.is_default) ||
      workspaces[0]
    );
  }, [workspaces, activeWorkspaceId]);

  const setActiveWorkspace = useCallback(
    (id: string) => {
      setActiveWorkspaceId(id);
    },
    [setActiveWorkspaceId],
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  const createMutation = useMutation({
    mutationFn: createWorkspace,
    onMutate: async (formData: FormData) => {
      await queryClient.cancelQueries({ queryKey });
      const previousWorkspaces = queryClient.getQueryData(queryKey);

      const name = formData.get("name") as string;
      const tempId = generateTempId();
      const isFirstWorkspace = workspaces.length === 0;

      const optimisticWorkspace = {
        id: tempId,
        name,
        is_public: false,
        is_default: isFirstWorkspace,
        auto_check_broken: false,
        bookmarks_count: 0,
        user_id: user?.id || "",
        created_at: new Date().toISOString(),
        updated_at: null,
      } satisfies WorkspaceWithCount;

      queryClient.setQueryData(queryKey, (old: WorkspaceWithCount[] = []) => [
        ...old,
        optimisticWorkspace,
      ]);

      return { previousWorkspaces };
    },
    onError: (error, _variables, context) => {
      console.error("[useWorkspaces] createWorkspace failed:", error);
      if (context?.previousWorkspaces) {
        queryClient.setQueryData(queryKey, context.previousWorkspaces);
      }
      toast.error("Failed to create workspace");
    },
    onSuccess: (data) => {
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("Workspace created");
        if (data.data?.id) {
          setActiveWorkspace(data.data.id);
        }
      }
    },
    onSettled: () => {
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWorkspace,
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey });
      const previousWorkspaces = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (old: WorkspaceWithCount[] = []) =>
        old.filter((ws) => ws.id !== id),
      );

      return { previousWorkspaces };
    },
    onError: (error, _variables, context) => {
      console.error("[useWorkspaces] deleteWorkspace failed:", error);
      if (context?.previousWorkspaces) {
        queryClient.setQueryData(queryKey, context.previousWorkspaces);
      }
      toast.error("Failed to delete workspace");
    },
    onSuccess: (data) => {
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("Workspace deleted");
        const nextWs =
          workspaces.find(
            (ws) => ws.id !== activeWorkspaceId && ws.is_default,
          ) || workspaces.find((ws) => ws.id !== activeWorkspaceId);
        if (nextWs) {
          setActiveWorkspace(nextWs.id);
        } else {
          setActiveWorkspaceId(null);
        }
      }
    },
    onSettled: () => {
      invalidate();
    },
  });

  const publicToggleMutation = useMutation({
    mutationFn: ({ id, isPublic }: { id: string; isPublic: boolean }) =>
      togglePublicStatus(id, isPublic),
    onMutate: async ({ id, isPublic }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousWorkspaces = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (old: WorkspaceWithCount[] = []) =>
        old.map((ws) => (ws.id === id ? { ...ws, is_public: isPublic } : ws)),
      );

      return { previousWorkspaces };
    },
    onError: (error, _variables, context) => {
      console.error("[useWorkspaces] togglePublicStatus failed:", error);
      if (context?.previousWorkspaces) {
        queryClient.setQueryData(queryKey, context.previousWorkspaces);
      }
      toast.error("Failed to toggle visibility");
    },
    onSuccess: (data, variables) => {
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success(
          `Workspace is now ${variables.isPublic ? "public" : "private"}`,
        );
      }
    },
    onSettled: () => {
      invalidate();
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: setDefaultWorkspace,
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey });
      const previousWorkspaces = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (old: WorkspaceWithCount[] = []) =>
        old.map((ws) => ({
          ...ws,
          is_default: ws.id === id,
        })),
      );

      return { previousWorkspaces };
    },
    onError: (error, _variables, context) => {
      console.error("[useWorkspaces] setDefaultWorkspace failed:", error);
      if (context?.previousWorkspaces) {
        queryClient.setQueryData(queryKey, context.previousWorkspaces);
      }
      toast.error("Failed to set default workspace");
    },
    onSuccess: (data) => {
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("Default workspace updated");
      }
    },
    onSettled: () => {
      invalidate();
    },
  });

  const autoCheckMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      toggleAutoCheckBroken(id, enabled),
    onMutate: async ({ id, enabled }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousWorkspaces = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (old: WorkspaceWithCount[] = []) =>
        old.map((ws) =>
          ws.id === id ? { ...ws, auto_check_broken: enabled } : ws,
        ),
      );

      return { previousWorkspaces };
    },
    onError: (error, _variables, context) => {
      console.error("[useWorkspaces] toggleAutoCheckBroken failed:", error);
      if (context?.previousWorkspaces) {
        queryClient.setQueryData(queryKey, context.previousWorkspaces);
      }
      toast.error("Failed to toggle auto check");
    },
    onSuccess: (data, variables) => {
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success(
          variables.enabled
            ? "Weekly URL check enabled"
            : "Weekly URL check disabled",
        );
      }
    },
    onSettled: () => {
      invalidate();
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      renameWorkspace(id, name),
    onMutate: async ({ id, name }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousWorkspaces = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (old: WorkspaceWithCount[] = []) =>
        old.map((ws) => (ws.id === id ? { ...ws, name } : ws)),
      );

      return { previousWorkspaces };
    },
    onError: (error, _variables, context) => {
      console.error("[useWorkspaces] renameWorkspace failed:", error);
      if (context?.previousWorkspaces) {
        queryClient.setQueryData(queryKey, context.previousWorkspaces);
      }
      toast.error("Failed to rename workspace");
    },
    onSuccess: (data) => {
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("Workspace renamed");
      }
    },
    onSettled: () => {
      invalidate();
    },
  });

  return {
    workspaces,
    currentWorkspace,
    isLoading: isAuthLoading || isWsLoading,
    setActiveWorkspace,
    createWorkspace: createMutation.mutate,
    isCreating: createMutation.isPending,
    deleteWorkspace: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    togglePublicStatus: publicToggleMutation.mutate,
    isTogglingPublic: publicToggleMutation.isPending,
    setDefaultWorkspace: setDefaultMutation.mutate,
    isSettingDefault: setDefaultMutation.isPending,
    toggleAutoCheckBroken: autoCheckMutation.mutate,
    isTogglingAutoCheck: autoCheckMutation.isPending,
    renameWorkspace: renameMutation.mutate,
    isRenaming: renameMutation.isPending,
  };
}
