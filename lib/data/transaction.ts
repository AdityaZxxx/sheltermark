import { z } from "zod";

import type { ActionResult } from "~/lib/action-result";
import type { DbClient } from "~/lib/data/db-client";

const rpcResultSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  data: z.null(),
});

export async function deleteWorkspaceWithBookmarks(
  supabase: DbClient,
  userId: string,
  workspaceId: string,
): Promise<ActionResult<null>> {
  const { data, error } = await supabase.rpc(
    "delete_workspace_with_bookmarks",
    {
      p_workspace_id: workspaceId,
      p_user_id: userId,
    },
  );

  if (error) return { success: false, error: error.message };

  const result = rpcResultSchema.safeParse(data);
  if (!result.success)
    return {
      success: false,
      error: "Unexpected response from delete_workspace_with_bookmarks",
    };
  if (!result.data.success)
    return { success: false, error: result.data.error ?? "Unknown error" };
  return { success: true, data: null };
}

export async function emptyUserTrash(
  supabase: DbClient,
  userId: string,
): Promise<ActionResult<null>> {
  const { data, error } = await supabase.rpc("empty_user_trash", {
    p_user_id: userId,
  });

  if (error) return { success: false, error: error.message };

  const result = rpcResultSchema.safeParse(data);
  if (!result.success)
    return {
      success: false,
      error: "Unexpected response from empty_user_trash",
    };
  if (!result.data.success)
    return { success: false, error: result.data.error ?? "Unknown error" };
  return { success: true, data: null };
}
