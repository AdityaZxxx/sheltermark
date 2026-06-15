import {
  updateProfile,
  updatePublicProfile,
} from "~/app/action/setting.action";
import { useOptimisticMutation } from "~/lib/mutations/base";
import { profileKeys } from "~/lib/query-keys";
import type {
  Profile,
  UpdateProfileInput,
  UpdatePublicProfileInput,
} from "~/lib/schemas/profile.schema";

export function useUpdateProfile(userId: string | undefined) {
  return useOptimisticMutation<UpdateProfileInput, { message: string }>({
    mutationFn: updateProfile,
    queryKey: profileKeys.byUser(userId),
    successMessage: "Profile updated",
    errorMessage: "Failed to update profile",
    prepareOptimisticData: (oldData, variables) => {
      const prev = oldData as Profile | null;
      return prev ? { ...prev, ...variables } : prev;
    },
  });
}

export function useUpdatePublicProfile(userId: string | undefined) {
  return useOptimisticMutation<UpdatePublicProfileInput, { message: string }>({
    mutationFn: updatePublicProfile,
    queryKey: profileKeys.byUser(userId),
    successMessage: "Public profile updated",
    errorMessage: "Failed to update public profile",
    prepareOptimisticData: (oldData, variables) => {
      const prev = oldData as Profile | null;
      return prev ? { ...prev, ...variables } : prev;
    },
  });
}
