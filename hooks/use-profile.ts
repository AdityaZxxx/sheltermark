"use client";

import { useQuery } from "@tanstack/react-query";
import { getProfile } from "~/app/action/setting";

export interface Profile {
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
