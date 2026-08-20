import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "~/lib/data/db";
import {
  createWorkspaceRaw,
  deleteWorkspace,
  getDefaultWorkspace,
  getTrashedWorkspaces,
  getWorkspaces,
  permanentDeleteWorkspace,
  renameWorkspace,
  setDefaultWorkspace,
  toggleAutoCheckBroken,
  togglePublicStatus,
} from "~/lib/data/repositories/workspace.repository";
import { bookmarks, workspaces } from "~/lib/data/schema";
import { deleteWorkspaceWithBookmarks } from "~/lib/data/transaction";
import { restoreWorkspace } from "~/lib/restore/service";

/**
 * Live-database cross-user isolation tests for the workspace repository.
 * Same posture as the tag suite: service-role connection bypasses RLS, so
 * every function must enforce ownership itself. Footprint is limited to
 * workspaces/bookmarks named with the drizzle-iso- prefix, cleaned in
 * afterAll.
 *
 * emptyUserTrash is deliberately NOT exercised here: it hard-deletes ALL of
 * the caller's trashed rows, including seeded data that must remain.
 */
const AGENT_USER = "52a3cabd-90dd-4019-8267-b926ffd59a6e";
const FOREIGN_USER = "8256b5a2-2c49-4e30-afd1-671c183fb7c9";

const PREFIX = "drizzle-iso-";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)(
  "workspace repository — Drizzle isolation suite",
  () => {
    let foreignWorkspaceId: string;
    let previousDefaultId: string | null = null;
    const createdWorkspaceIds: string[] = [];

    beforeAll(async () => {
      const db = getDb();

      const [foreignWorkspace] = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.userId, FOREIGN_USER))
        .limit(1);
      if (!foreignWorkspace)
        throw new Error("Seed data missing: foreign user has no workspaces");
      foreignWorkspaceId = foreignWorkspace.id;

      const defaultResult = await getDefaultWorkspace(db, AGENT_USER);
      if (defaultResult.success) {
        previousDefaultId = defaultResult.data?.id ?? null;
      }
    });

    afterAll(async () => {
      const db = getDb();
      const wsRows = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.userId, AGENT_USER));
      const createdIds = wsRows
        .filter((ws) => ws.name.startsWith(PREFIX))
        .map((ws) => ws.id);
      if (createdIds.length > 0) {
        await db
          .delete(bookmarks)
          .where(
            and(
              inArray(bookmarks.workspaceId, createdIds),
              eq(bookmarks.userId, AGENT_USER),
            ),
          );
        await db.delete(workspaces).where(inArray(workspaces.id, createdIds));
      }

      // Restore default workspace to pre-suite state.
      if (previousDefaultId) {
        await setDefaultWorkspace(db, AGENT_USER, previousDefaultId);
      }
    });

    describe("cross-user isolation (RLS bypassed)", () => {
      it("getWorkspaces returns only the caller's workspaces", async () => {
        const result = await getWorkspaces(getDb(), AGENT_USER);
        expect(result.success).toBe(true);
        if (!result.success) return;
        for (const ws of result.data) {
          expect(ws.user_id).toBe(AGENT_USER);
        }
        expect(result.data.map((ws) => ws.id)).not.toContain(
          foreignWorkspaceId,
        );
      });

      it("getTrashedWorkspaces returns only the caller's trashed workspaces", async () => {
        const result = await getTrashedWorkspaces(getDb(), AGENT_USER);
        expect(result.success).toBe(true);
        if (!result.success) return;
        for (const ws of result.data) {
          expect(ws.user_id).toBe(AGENT_USER);
        }
      });

      it("deleteWorkspace cannot soft-delete another user's workspace", async () => {
        const result = await deleteWorkspace(
          getDb(),
          AGENT_USER,
          foreignWorkspaceId,
        );
        expect(result.success).toBe(false);

        const [row] = await getDb()
          .select({ deletedAt: workspaces.deletedAt })
          .from(workspaces)
          .where(eq(workspaces.id, foreignWorkspaceId));
        expect(row?.deletedAt).toBeNull();
      });

      it("renameWorkspace cannot rename another user's workspace", async () => {
        const [before] = await getDb()
          .select({ name: workspaces.name })
          .from(workspaces)
          .where(eq(workspaces.id, foreignWorkspaceId));

        const result = await renameWorkspace(
          getDb(),
          AGENT_USER,
          foreignWorkspaceId,
          `${PREFIX}pwned`,
        );
        expect(result.success).toBe(true);

        const [after] = await getDb()
          .select({ name: workspaces.name })
          .from(workspaces)
          .where(eq(workspaces.id, foreignWorkspaceId));
        expect(after?.name).toBe(before?.name);
      });

      it("togglePublicStatus cannot toggle another user's workspace", async () => {
        const [before] = await getDb()
          .select({ isPublic: workspaces.isPublic })
          .from(workspaces)
          .where(eq(workspaces.id, foreignWorkspaceId));

        await togglePublicStatus(
          getDb(),
          AGENT_USER,
          foreignWorkspaceId,
          !(before?.isPublic ?? false),
        );

        const [after] = await getDb()
          .select({ isPublic: workspaces.isPublic })
          .from(workspaces)
          .where(eq(workspaces.id, foreignWorkspaceId));
        expect(after?.isPublic).toBe(before?.isPublic);
      });

      it("toggleAutoCheckBroken cannot toggle another user's workspace", async () => {
        const [before] = await getDb()
          .select({ autoCheckBroken: workspaces.autoCheckBroken })
          .from(workspaces)
          .where(eq(workspaces.id, foreignWorkspaceId));

        await toggleAutoCheckBroken(
          getDb(),
          AGENT_USER,
          foreignWorkspaceId,
          !(before?.autoCheckBroken ?? false),
        );

        const [after] = await getDb()
          .select({ autoCheckBroken: workspaces.autoCheckBroken })
          .from(workspaces)
          .where(eq(workspaces.id, foreignWorkspaceId));
        expect(after?.autoCheckBroken).toBe(before?.autoCheckBroken);
      });

      it("permanentDeleteWorkspace cannot delete another user's workspace", async () => {
        const result = await permanentDeleteWorkspace(
          getDb(),
          AGENT_USER,
          foreignWorkspaceId,
        );
        expect(result.success).toBe(true);

        const [row] = await getDb()
          .select({ id: workspaces.id })
          .from(workspaces)
          .where(eq(workspaces.id, foreignWorkspaceId));
        expect(row?.id).toBe(foreignWorkspaceId);
      });
    });

    describe("behavior parity on own rows", () => {
      it("creates, renames, toggles, defaults, soft-deletes, restores, and permanently deletes", async () => {
        const db = getDb();

        const created = await createWorkspaceRaw(
          db,
          AGENT_USER,
          `${PREFIX}lifecycle`,
        );
        expect(created.success).toBe(true);
        if (!created.success) return;
        const wsId = created.data.id;
        createdWorkspaceIds.push(wsId);

        const listed = await getWorkspaces(db, AGENT_USER);
        expect(listed.success).toBe(true);
        if (listed.success) {
          expect(listed.data.map((ws) => ws.id)).toContain(wsId);
        }

        const renamed = await renameWorkspace(
          db,
          AGENT_USER,
          wsId,
          `${PREFIX}lifecycle-renamed`,
        );
        expect(renamed.success).toBe(true);

        await togglePublicStatus(db, AGENT_USER, wsId, true);
        await toggleAutoCheckBroken(db, AGENT_USER, wsId, false);
        const [toggled] = await db
          .select({
            isPublic: workspaces.isPublic,
            autoCheckBroken: workspaces.autoCheckBroken,
          })
          .from(workspaces)
          .where(eq(workspaces.id, wsId));
        expect(toggled?.isPublic).toBe(true);
        expect(toggled?.autoCheckBroken).toBe(false);

        const setDefault = await setDefaultWorkspace(db, AGENT_USER, wsId);
        expect(setDefault.success).toBe(true);
        const defaultNow = await getDefaultWorkspace(db, AGENT_USER);
        expect(defaultNow.success).toBe(true);
        if (defaultNow.success) {
          expect(defaultNow.data?.id).toBe(wsId);
        }

        // Soft delete via RPC path; RPC rejects deleting the default workspace.
        const blocked = await deleteWorkspace(db, AGENT_USER, wsId);
        expect(blocked.success).toBe(false);

        if (previousDefaultId) {
          await setDefaultWorkspace(db, AGENT_USER, previousDefaultId);
        }
        const softDeleted = await deleteWorkspaceWithBookmarks(
          db,
          AGENT_USER,
          wsId,
        );
        if (softDeleted.success) {
          const trashed = await getTrashedWorkspaces(db, AGENT_USER);
          if (trashed.success) {
            expect(trashed.data.map((ws) => ws.id)).toContain(wsId);
          }

          const restored = await restoreWorkspace(db, AGENT_USER, wsId);
          expect(restored.success).toBe(true);
        }

        const hard = await permanentDeleteWorkspace(db, AGENT_USER, wsId);
        expect(hard.success).toBe(true);
        const [gone] = await db
          .select({ id: workspaces.id })
          .from(workspaces)
          .where(
            and(eq(workspaces.id, wsId), eq(workspaces.userId, AGENT_USER)),
          );
        expect(gone).toBeUndefined();
      });

      it("createWorkspaceRaw is user-scoped and returns the new id", async () => {
        const db = getDb();
        const created = await createWorkspaceRaw(
          db,
          AGENT_USER,
          `${PREFIX}scoped`,
        );
        expect(created.success).toBe(true);
        if (!created.success) return;
        createdWorkspaceIds.push(created.data.id);

        const [row] = await db
          .select({ userId: workspaces.userId, name: workspaces.name })
          .from(workspaces)
          .where(eq(workspaces.id, created.data.id));
        expect(row?.userId).toBe(AGENT_USER);
        expect(row?.name).toBe(`${PREFIX}scoped`);
      });
    });
  },
);
