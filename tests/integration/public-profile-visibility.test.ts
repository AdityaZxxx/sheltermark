import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";

import { getDb } from "~/lib/data/db";
import { getPublicProfile } from "~/lib/data/repositories/profile.repository";
import { bookmarks, profiles, workspaces } from "~/lib/data/schema";

/**
 * Public-profile read path: RLS parity for anonymous readers. The Drizzle
 * connection bypasses RLS, so getPublicProfile must reproduce the public
 * SELECT policies by hand: only bookmarks of PUBLIC workspaces, never
 * soft-deleted rows. Regression guard for the deleted-bookmark leak.
 */
const AGENT_USER = "52a3cabd-90dd-4019-8267-b926ffd59a6e";

const USERNAME = "drizzle_iso_pub";
const PREFIX = "drizzle-iso-";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("public profile read — visibility parity", () => {
  let publicWsId: string;
  let privateWsId: string;
  let liveId: string;
  let trashedId: string;
  let privateBookmarkId: string;
  let prevUsername: string | null;
  let prevIsPublic: boolean;

  beforeAll(async () => {
    const db = getDb();

    const [profile] = await db
      .select({ username: profiles.username, isPublic: profiles.is_public })
      .from(profiles)
      .where(eq(profiles.id, AGENT_USER));
    if (!profile) throw new Error("Seed data missing: agent profile");
    prevUsername = profile.username;
    prevIsPublic = profile.isPublic;

    const [publicWs] = await db
      .insert(workspaces)
      .values({
        user_id: AGENT_USER,
        name: `${PREFIX}pub`,
        is_public: true,
        is_default: false,
      })
      .returning({ id: workspaces.id });
    const [privateWs] = await db
      .insert(workspaces)
      .values({
        user_id: AGENT_USER,
        name: `${PREFIX}priv`,
        is_public: false,
        is_default: false,
      })
      .returning({ id: workspaces.id });
    if (!publicWs || !privateWs)
      throw new Error("fixture workspace insert failed");
    publicWsId = publicWs.id;
    privateWsId = privateWs.id;

    const now = new Date().toISOString();
    const inserted = await db
      .insert(bookmarks)
      .values([
        {
          user_id: AGENT_USER,
          workspace_id: publicWsId,
          url: `https://example.com/${PREFIX}live`,
          title: `${PREFIX}live`,
        },
        {
          user_id: AGENT_USER,
          workspace_id: publicWsId,
          url: `https://example.com/${PREFIX}trashed`,
          title: `${PREFIX}trashed`,
          deleted_at: now,
        },
        {
          user_id: AGENT_USER,
          workspace_id: privateWsId,
          url: `https://example.com/${PREFIX}private-ws`,
          title: `${PREFIX}private-ws`,
        },
      ])
      .returning({ id: bookmarks.id });
    const [live, trashed, privateBm] = inserted;
    if (!live || !trashed || !privateBm)
      throw new Error("fixture bookmark insert failed");
    liveId = live.id;
    trashedId = trashed.id;
    privateBookmarkId = privateBm.id;

    await db
      .update(profiles)
      .set({ username: USERNAME, is_public: true })
      .where(eq(profiles.id, AGENT_USER));
  });

  afterAll(async () => {
    const db = getDb();
    await db.delete(bookmarks).where(eq(bookmarks.workspace_id, publicWsId));
    await db.delete(bookmarks).where(eq(bookmarks.workspace_id, privateWsId));
    await db.delete(workspaces).where(eq(workspaces.id, publicWsId));
    await db.delete(workspaces).where(eq(workspaces.id, privateWsId));
    await db
      .update(profiles)
      .set({ username: prevUsername, is_public: prevIsPublic })
      .where(eq(profiles.id, AGENT_USER));
  });

  it("returns live public-workspace bookmarks but never trashed or private-workspace ones", async () => {
    const result = await getPublicProfile(getDb(), USERNAME);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const ws = result.data.workspaces.find((w) => w.id === publicWsId);
    expect(ws).toBeDefined();
    if (!ws) return;

    const ids = ws.bookmarks.map((b) => b.id);
    expect(ids).toContain(liveId);
    expect(ids).not.toContain(trashedId);
    expect(ids).not.toContain(privateBookmarkId);
  });

  it("omits private workspaces entirely", async () => {
    const result = await getPublicProfile(getDb(), USERNAME);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.workspaces.map((w) => w.id)).not.toContain(privateWsId);
  });

  it("returns not found for a private profile", async () => {
    const db = getDb();
    await db
      .update(profiles)
      .set({ is_public: false })
      .where(eq(profiles.id, AGENT_USER));

    const result = await getPublicProfile(getDb(), USERNAME);
    expect(result).toMatchObject({
      success: false,
      error: "Profile not found",
    });
  });
});
