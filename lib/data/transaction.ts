import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActionResult } from "~/lib/action-result";

type RpcResult = { success: boolean; error?: string; data: null };

export async function deleteWorkspaceWithBookmarks(
  supabase: SupabaseClient,
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

  const result = data as unknown as RpcResult;
  if (!result.success)
    return { success: false, error: result.error ?? "Unknown error" };
  return { success: true, data: null };
}

export async function emptyUserTrash(
  supabase: SupabaseClient,
  userId: string,
): Promise<ActionResult<null>> {
  const { data, error } = await supabase.rpc("empty_user_trash", {
    p_user_id: userId,
  });

  if (error) return { success: false, error: error.message };

  const result = data as unknown as RpcResult;
  if (!result.success)
    return { success: false, error: result.error ?? "Unknown error" };
  return { success: true, data: null };
}
