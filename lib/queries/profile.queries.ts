import type { Profile } from "~/lib/schemas/profile.schema";

import { getProfile } from "~/app/action/setting.action";
import { profileKeys } from "~/lib/query-keys";

export const profileQueryOptions = (userId: string | undefined) => ({
  queryKey: profileKeys.byUser(userId),
  queryFn: async (): Promise<Profile | null> => {
    if (!userId) return null;
    const result = await getProfile();
    if (!result.success) throw new Error(result.error);
    return result.data?.profile ?? null;
  },
  enabled: !!userId,
  placeholderData: (previousData: Profile | null | undefined) => previousData,
});
