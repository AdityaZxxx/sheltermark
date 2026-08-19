import type { WorkspaceWithCount } from "~/lib/schemas/workspace.schema";

import { getWorkspaces } from "~/app/action/workspace.action";
import { workspaceKeys } from "~/lib/query-keys";

export const workspacesQueryOptions = (userId: string | undefined) => ({
  queryKey: workspaceKeys.byUser(userId),
  queryFn: async (): Promise<WorkspaceWithCount[]> => {
    const result = await getWorkspaces();
    if (!result.success) throw new Error(result.error);
    return result.data;
  },
  enabled: !!userId,
  refetchOnMount: false,
  placeholderData: (previousData: WorkspaceWithCount[] | undefined) =>
    previousData,
});
