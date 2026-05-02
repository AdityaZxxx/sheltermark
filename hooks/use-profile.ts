"use client";

import { useQuery } from "@tanstack/react-query";
import { useSupabase } from "~/components/providers/supabase-provider";
import { useUser } from "~/components/providers/user-context";
import {
  useUpdateProfile,
  useUpdatePublicProfile,
} from "~/lib/mutations/profile.mutations";
import { profileQueryOptions } from "~/lib/queries/profile.queries";

export function useProfile() {
  const { user: supabaseUser, isLoading: isAuthLoading } = useSupabase();
  const serverUser = useUser();
  const userId = serverUser?.id ?? supabaseUser?.id;

  const { data, isLoading } = useQuery(profileQueryOptions(userId));

  const updateMutation = useUpdateProfile(userId);
  const updatePublicMutation = useUpdatePublicProfile(userId);

  return {
    profile: data,
    isLoading: isAuthLoading || isLoading,
    updateProfile: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    updatePublicProfile: updatePublicMutation.mutate,
    isUpdatingPublic: updatePublicMutation.isPending,
  };
}
