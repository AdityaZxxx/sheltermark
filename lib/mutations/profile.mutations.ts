import type {
  Profile,
  UpdateProfileInput,
  UpdatePublicProfileInput,
} from "~/lib/schemas/profile.schema";

import {
  updateProfile,
  updatePublicProfile,
} from "~/app/action/setting.action";
import { useOptimisticMutation } from "~/lib/mutations/base";
import { profileKeys } from "~/lib/query-keys";

export function useUpdateProfile(userId: string) {
  return useOptimisticMutation<
    UpdateProfileInput,
    { message: string },
    Profile | null
  >({
    mutationFn: updateProfile,
    queryKey: profileKeys.all(userId),
    successMessage: "Profile updated",
    errorMessage: "Failed to update profile",
    prepareOptimisticData: (oldData, variables) => {
      return oldData ? { ...oldData, ...variables } : null;
    },
  });
}

export function useUpdatePublicProfile(userId: string) {
  return useOptimisticMutation<
    UpdatePublicProfileInput,
    { message: string },
    Profile | null
  >({
    mutationFn: updatePublicProfile,
    queryKey: profileKeys.all(userId),
    successMessage: "Public profile updated",
    errorMessage: "Failed to update public profile",
    prepareOptimisticData: (oldData, variables) => {
      if (!oldData) return null;
      return {
        ...oldData,
        username: variables.username,
        is_public: variables.is_public,
        bio: variables.bio ?? oldData.bio,
      };
    },
  });
}
