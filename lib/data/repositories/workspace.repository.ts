import "server-only";
import { and, asc, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { z } from "zod";

import type { ActionResult } from "~/lib/action-result";
import type { DrizzleDb } from "~/lib/data/db";
import type { Bookmark } from "~/lib/schemas/bookmark.schema";
import type {
  TrashedWorkspace,
  Workspace,
  WorkspaceWithCount,
} from "~/lib/schemas/workspace.schema";

import { bookmarks, workspaces } from "~/lib/data/schema";
import { deleteWorkspaceWithBookmarks } from "~/lib/data/transaction";
import {
  workspaceCreateSchema,
  workspaceRenameSchema,
} from "~/lib/schemas/workspace.schema";

type WorkspaceRow = typeof workspaces.$inferSelect;
type BookmarkRow = typeof bookmarks.$inferSelect;

const workspaceIdRowSchema = z.object({ id: z.string().min(1) });

function toWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    user_id: row.userId,
    name: row.name,
    is_public: row.isPublic ?? false,
    is_default: row.isDefault,
    auto_check_broken: row.autoCheckBroken ?? true,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt?.toISOString() ?? null,
    deleted_at: row.deletedAt?.toISOString() ?? null,
  };
}

function toBookmark(row: BookmarkRow): Bookmark {
  return {
    id: row.id,
    user_id: row.user_id,
    workspace_id: row.workspace_id,
    url: row.url,
    title: row.title ?? "",
    favicon_url: row.favicon_url,
    og_image_url: row.og_image_url,
    is_public: row.is_public ?? false,
    is_broken: row.is_broken ?? false,
    broken_status: row.broken_status ?? "alive",
    http_status: row.http_status,
    last_checked_at: row.last_checked_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
    note: row.note,
  };
}

function dbError(cause: unknown): ActionResult<never> {
  return {
    success: false,
    error: cause instanceof Error ? cause.message : "Database error",
  };
}

/**
 * SECURITY: Drizzle connects with the service-role credential and BYPASSES
 * ROW LEVEL SECURITY. Every query in this file enforces `user_id` ownership
 * explicitly.
 */
export async function getWorkspaces(
  db: DrizzleDb,
  userId: string,
): Promise<ActionResult<WorkspaceWithCount[]>> {
  try {
    const [wsRows, countRows] = await Promise.all([
      db
        .select()
        .from(workspaces)
        .where(and(eq(workspaces.userId, userId), isNull(workspaces.deletedAt)))
        .orderBy(asc(workspaces.createdAt)),
      db
        .select({ workspaceId: bookmarks.workspace_id })
        .from(bookmarks)
        .where(
          and(
            eq(bookmarks.user_id, userId),
            isNull(bookmarks.deleted_at),
            isNotNull(bookmarks.workspace_id),
          ),
        ),
    ]);

    const countMap = new Map<string, number>();
    for (const row of countRows) {
      const workspaceId = row.workspaceId;
      if (!workspaceId) continue;
      countMap.set(workspaceId, (countMap.get(workspaceId) ?? 0) + 1);
    }

    return {
      success: true,
      data: wsRows.map((row) => {
        const workspace = toWorkspace(row);
        return {
          ...workspace,
          bookmarks_count: countMap.get(workspace.id) ?? 0,
        };
      }),
    };
  } catch (cause) {
    return dbError(cause);
  }
}

export async function createWorkspace(
  db: DrizzleDb,
  userId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const rawData = Object.fromEntries(formData.entries());
  const validated = workspaceCreateSchema.safeParse(rawData);
  if (!validated.success) {
    const msg =
      validated.error?.issues?.[0]?.message ?? "Invalid workspace data";
    return { success: false, error: msg };
  }

  try {
    const [row] = await db
      .insert(workspaces)
      .values({
        userId,
        name: validated.data.name,
        isDefault: false,
        isPublic: false,
      })
      .returning({ id: workspaces.id });

    const parsed = workspaceIdRowSchema.safeParse(row);
    if (!parsed.success) {
      return { success: false, error: "Invalid workspace data returned" };
    }
    return { success: true, data: { id: parsed.data.id } };
  } catch (cause) {
    return dbError(cause);
  }
}

export async function deleteWorkspace(
  db: DrizzleDb,
  userId: string,
  id: string,
): Promise<ActionResult<null>> {
  return deleteWorkspaceWithBookmarks(db, userId, id);
}

export async function getTrashedWorkspaces(
  db: DrizzleDb,
  userId: string,
): Promise<ActionResult<TrashedWorkspace[]>> {
  try {
    const [wsRows, bmRows] = await Promise.all([
      db
        .select()
        .from(workspaces)
        .where(
          and(eq(workspaces.userId, userId), isNotNull(workspaces.deletedAt)),
        )
        .orderBy(desc(workspaces.deletedAt)),
      db
        .select()
        .from(bookmarks)
        .where(
          and(eq(bookmarks.user_id, userId), isNotNull(bookmarks.deleted_at)),
        )
        .orderBy(desc(bookmarks.deleted_at)),
    ]);

    const trashedWorkspaceIds = new Set(wsRows.map((ws) => ws.id));

    const bookmarksByWs = new Map<string, Bookmark[]>();
    for (const row of bmRows) {
      const bookmark = toBookmark(row);
      if (
        bookmark.workspace_id &&
        trashedWorkspaceIds.has(bookmark.workspace_id)
      ) {
        const list = bookmarksByWs.get(bookmark.workspace_id) ?? [];
        list.push(bookmark);
        bookmarksByWs.set(bookmark.workspace_id, list);
      }
    }

    return {
      success: true,
      data: wsRows.map((row) => {
        const workspace = toWorkspace(row);
        return {
          ...workspace,
          bookmarks_count: bookmarksByWs.get(workspace.id)?.length ?? 0,
          bookmarks: bookmarksByWs.get(workspace.id) ?? [],
        };
      }),
    };
  } catch (cause) {
    return dbError(cause);
  }
}

export async function permanentDeleteWorkspace(
  db: DrizzleDb,
  userId: string,
  id: string,
): Promise<ActionResult<null>> {
  try {
    // Hard-delete bookmarks first (avoids CASCADE issues with tracking)
    await db
      .delete(bookmarks)
      .where(
        and(eq(bookmarks.workspace_id, id), eq(bookmarks.user_id, userId)),
      );

    await db
      .delete(workspaces)
      .where(and(eq(workspaces.id, id), eq(workspaces.userId, userId)));
    return { success: true, data: null };
  } catch (cause) {
    return dbError(cause);
  }
}

export async function togglePublicStatus(
  db: DrizzleDb,
  userId: string,
  id: string,
  isPublic: boolean,
): Promise<ActionResult<null>> {
  try {
    await db
      .update(workspaces)
      .set({ isPublic })
      .where(and(eq(workspaces.id, id), eq(workspaces.userId, userId)));
    return { success: true, data: null };
  } catch (cause) {
    return dbError(cause);
  }
}

export async function setDefaultWorkspace(
  db: DrizzleDb,
  userId: string,
  id: string,
): Promise<ActionResult<null>> {
  try {
    await db
      .update(workspaces)
      .set({ isDefault: false })
      .where(eq(workspaces.userId, userId));

    await db
      .update(workspaces)
      .set({ isDefault: true })
      .where(and(eq(workspaces.id, id), eq(workspaces.userId, userId)));
    return { success: true, data: null };
  } catch (cause) {
    return dbError(cause);
  }
}

export async function toggleAutoCheckBroken(
  db: DrizzleDb,
  userId: string,
  id: string,
  enabled: boolean,
): Promise<ActionResult<null>> {
  try {
    await db
      .update(workspaces)
      .set({ autoCheckBroken: enabled })
      .where(and(eq(workspaces.id, id), eq(workspaces.userId, userId)));
    return { success: true, data: null };
  } catch (cause) {
    return dbError(cause);
  }
}

export async function createWorkspaceRaw(
  db: DrizzleDb,
  userId: string,
  name: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const [row] = await db
      .insert(workspaces)
      .values({ userId, name, isDefault: false, isPublic: false })
      .returning({ id: workspaces.id });

    if (!row) {
      return {
        success: false,
        error: "Failed to create workspace: no data returned",
      };
    }
    return { success: true, data: { id: row.id } };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Database error";
    return { success: false, error: `Failed to create workspace: ${message}` };
  }
}

export async function getDefaultWorkspace(
  db: DrizzleDb,
  userId: string,
): Promise<ActionResult<{ id: string } | null>> {
  try {
    const [row] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(and(eq(workspaces.userId, userId), eq(workspaces.isDefault, true)))
      .limit(1);
    return { success: true, data: row ? { id: row.id } : null };
  } catch (cause) {
    return dbError(cause);
  }
}

export async function renameWorkspace(
  db: DrizzleDb,
  userId: string,
  id: string,
  name: string,
): Promise<ActionResult<null>> {
  const validated = workspaceRenameSchema.safeParse({ id, name });
  if (!validated.success) {
    const msg =
      validated.error?.issues?.[0]?.message ?? "Invalid workspace data";
    return { success: false, error: msg };
  }

  try {
    await db
      .update(workspaces)
      .set({ name: validated.data.name })
      .where(
        and(
          eq(workspaces.id, validated.data.id),
          eq(workspaces.userId, userId),
        ),
      );
    return { success: true, data: null };
  } catch (cause) {
    return dbError(cause);
  }
}
