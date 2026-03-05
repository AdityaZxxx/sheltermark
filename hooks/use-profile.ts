"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getProfile,
  updateProfile as updateProfileAction,
  updatePublicProfile as updatePublicProfileAction,
} from "~/app/action/setting";
import { useSupabase } from "~/components/providers/supabase-provider";
import type { Profile } from "../types/profile.types";

export function useProfile() {
  const queryClient = useQueryClient();
  const { user, isLoading: isAuthLoading } = useSupabase();

  const queryKey = ["profile", user?.id] as const;

  const { data, isLoading } = useQuery<Profile | null>({
    queryKey,
    queryFn: async () => {
      const result = await getProfile();
      if (result.error) {
        throw new Error(result.error);
      }
      return result.profile as Profile | null;
    },
    enabled: !!user?.id && !isAuthLoading,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { full_name: string }) => {
      const result = await updateProfileAction(data);
      return result;
    },
    onSuccess: (data) => {
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("Profile updated");
        queryClient.invalidateQueries({ queryKey });
      }
    },
  });

  const updatePublicMutation = useMutation({
    mutationFn: async (
      data: Parameters<typeof updatePublicProfileAction>[0],
    ) => {
      const result = await updatePublicProfileAction(data);
      return result;
    },
    onSuccess: (data) => {
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("Public profile updated");
        queryClient.invalidateQueries({ queryKey });
      }
    },
  });

  return {
    profile: data,
    isLoading: isAuthLoading || isLoading,
    updateProfile: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    updatePublicProfile: updatePublicMutation.mutate,
    isUpdatingPublic: updatePublicMutation.isPending,
  };
}
