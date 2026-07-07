"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getProfile,
  updateProfile as updateProfileAction,
  updatePublicProfile as updatePublicProfileAction,
} from "~/app/action/setting";
import { useSupabase } from "~/components/providers/supabase-provider";
import { profileKeys } from "~/lib/query-keys";
import type { Profile } from "~/lib/schemas/profile";

const profileQueryOptions = (userId: string | undefined) => ({
  queryKey: profileKeys.byUser(userId),
  queryFn: async () => {
    if (!userId) return null;
    const result = await getProfile();
    if (result.error) {
      throw new Error(result.error);
    }
    return result.profile || null;
  },
  enabled: !!userId,
});

export function useProfile() {
  const queryClient = useQueryClient();
  const { user, isLoading: isAuthLoading } = useSupabase();

  const queryKey = profileKeys.byUser(user?.id);

  const { data, isLoading } = useQuery<Profile | null>(
    profileQueryOptions(user?.id),
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
  };

  const updateMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      const result = await updateProfileAction(data);
      return result;
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey });
      const previousProfile = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (old: Profile | null) => ({
        ...old,
        name: variables.name,
      }));

      return { previousProfile };
    },
    onError: (error, _variables, context) => {
      console.error("[useProfile] updateProfile failed:", error);
      if (context?.previousProfile) {
        queryClient.setQueryData(queryKey, context.previousProfile);
      }
      toast.error("Failed to update profile");
    },
    onSuccess: (data) => {
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("Profile updated");
      }
    },
    onSettled: () => {
      invalidate();
    },
  });

  const updatePublicMutation = useMutation({
    mutationFn: async (
      data: Parameters<typeof updatePublicProfileAction>[0],
    ) => {
      const result = await updatePublicProfileAction(data);
      return result;
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey });
      const previousProfile = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (old: Profile | null) => ({
        ...old,
        is_public: variables.is_public,
      }));

      return { previousProfile };
    },
    onError: (error, _variables, context) => {
      console.error("[useProfile] updatePublicProfile failed:", error);
      if (context?.previousProfile) {
        queryClient.setQueryData(queryKey, context.previousProfile);
      }
      toast.error("Failed to update public profile");
    },
    onSuccess: (data) => {
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("Public profile updated");
      }
    },
    onSettled: () => {
      invalidate();
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
