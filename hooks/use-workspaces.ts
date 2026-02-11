"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  createWorkspace,
  deleteWorkspace,
  getWorkspaces,
  togglePublicStatus,
} from "~/app/action/workspace";

export function useWorkspaces() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const activeWorkspaceId = searchParams.get("workspace");

  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => getWorkspaces(),
  });

  const currentWorkspace = useMemo(() => {
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
      const params = new URLSearchParams(searchParams.toString());
      params.set("workspace", id);
      router.push(`?${params.toString()}`);
    },
    [router, searchParams],
  );

  const createMutation = useMutation({
    mutationFn: (formData: FormData) => createWorkspace(formData),
    onSuccess: (data) => {
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("Workspace created");
        queryClient.invalidateQueries({ queryKey: ["workspaces"] });
        if (data.data?.id) {
          setActiveWorkspace(data.data.id);
        }
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteWorkspace(id),
    onSuccess: (data) => {
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("Workspace deleted");
        queryClient.invalidateQueries({ queryKey: ["workspaces"] });
        // Fallback to default if deleted was active
        const nextWs =
          workspaces.find(
            (ws) => ws.id !== activeWorkspaceId && ws.is_default,
          ) || workspaces.find((ws) => ws.id !== activeWorkspaceId);
        if (nextWs) {
          setActiveWorkspace(nextWs.id);
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
        queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      }
    },
  });

  return {
    workspaces,
    currentWorkspace,
    isLoading,
    setActiveWorkspace,
    createWorkspace: createMutation.mutate,
    isCreating: createMutation.isPending,
    deleteWorkspace: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    togglePublicStatus: publicToggleMutation.mutate,
    isTogglingPublic: publicToggleMutation.isPending,
  };
}
