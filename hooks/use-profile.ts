"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getProfile,
  updateProfile,
  updatePublicProfile,
} from "~/app/action/setting";

export interface Profile {
  full_name: string | null;
  avatar_url: string | null;
  username: string | null;
  bio: string | null;
  github_url: string | null;
  x_url: string | null;
  website_url: string | null;
  is_public: boolean;
}

export function useProfile() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const result = await getProfile();
      if (result.error) {
        throw new Error(result.error);
      }
      return result.profile as Profile;
    },
    staleTime: 30000,
  });

  return {
    profile: data,
    isLoading,
    error,
  };
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return async (data: { full_name: string }) => {
    const result = await updateProfile(data);
    if (!result.error) {
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      await queryClient.invalidateQueries({ queryKey: ["user"] });
    }
    return result;
  };
}

export function useUpdatePublicProfile() {
  const queryClient = useQueryClient();

  return async (data: {
    username: string;
    is_public: boolean;
    bio?: string;
    github_username?: string;
    x_username?: string;
    website?: string;
    current_username?: string;
  }) => {
    const result = await updatePublicProfile(data);
    if (!result.error) {
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
    }
    return result;
  };
}
