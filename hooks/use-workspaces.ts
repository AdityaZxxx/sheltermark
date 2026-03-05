"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { useMemo } from "react";
import { toast } from "sonner";
import {
  createWorkspace,
  deleteWorkspace,
  getWorkspaces,
  setDefaultWorkspace,
  togglePublicStatus,
} from "~/app/action/workspace";
import { useSupabase } from "~/components/providers/supabase-provider";

export function useWorkspaces() {
  const queryClient = useQueryClient();
  const [activeWorkspaceId, setActiveWorkspaceId] = useQueryState("workspace");
  const { user, isLoading: isAuthLoading } = useSupabase();

  const queryKey = ["workspaces", user?.id] as const;

  const { data: workspaces = [], isLoading: isWsLoading } = useQuery({
    queryKey,
    queryFn: getWorkspaces,
    enabled: !!user?.id && !isAuthLoading,
  });

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

  const setActiveWorkspace = (id: string) => {
    setActiveWorkspaceId(id);
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const createMutation = useMutation({
    mutationFn: createWorkspace,
    onSuccess: (data) => {
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("Workspace created");
        invalidate();
        if (data.data?.id) setActiveWorkspace(data.data.id);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWorkspace,
    onSuccess: (data) => {
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("Workspace deleted");
        invalidate();
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
  });

  const publicToggleMutation = useMutation({
    mutationFn: ({ id, isPublic }: { id: string; isPublic: boolean }) =>
      togglePublicStatus(id, isPublic),
    onSuccess: (data, variables) => {
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success(
          `Workspace is now ${variables.isPublic ? "public" : "private"}`,
        );
        queryClient.invalidateQueries({ queryKey: ["workspaces", user?.id] });
      }
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: setDefaultWorkspace,
    onSuccess: (data) => {
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("Default workspace updated");
        queryClient.invalidateQueries({ queryKey: ["workspaces", user?.id] });
      }
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
  };
}
