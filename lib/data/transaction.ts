import "server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";

import type { DrizzleDb } from "~/lib/data/db";

import { dbError, type ActionResult } from "~/lib/action-result";

const rpcResultSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  data: z.null(),
});

const rpcRowSchema = z.object({ result: z.unknown() });

function parseRpcResult(
  rows: unknown[],
  errorLabel: string,
): ActionResult<null> {
  const row = rpcRowSchema.safeParse(rows[0]);
  const raw = row.success ? row.data.result : undefined;
  const parsed = rpcResultSchema.safeParse(raw);
  if (!parsed.success)
    return { success: false, error: `Unexpected response from ${errorLabel}` };
  if (!parsed.data.success)
    return { success: false, error: parsed.data.error ?? "Unknown error" };
  return { success: true, data: null };
}

export async function deleteWorkspaceWithBookmarks(
  db: DrizzleDb,
  userId: string,
  workspaceId: string,
): Promise<ActionResult<null>> {
  try {
    const rows = Array.from(
      await db.execute(
        sql`select public.delete_workspace_with_bookmarks(${workspaceId}::uuid, ${userId}::uuid) as "result"`,
      ),
    );
    return parseRpcResult(rows, "delete_workspace_with_bookmarks");
  } catch (cause) {
    return dbError("Workspace deletion transaction", cause);
  }
}

export async function emptyUserTrash(
  db: DrizzleDb,
  userId: string,
): Promise<ActionResult<null>> {
  try {
    const rows = Array.from(
      await db.execute(
        sql`select public.empty_user_trash(${userId}::uuid) as "result"`,
      ),
    );
    return parseRpcResult(rows, "empty_user_trash");
  } catch (cause) {
    return dbError("Empty trash transaction", cause);
  }
}
