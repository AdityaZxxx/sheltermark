import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { and, eq, like, sql } from "drizzle-orm";

import { getDb } from "~/lib/data/db";
import { moveBookmarks } from "~/lib/data/repositories/bookmark.repository";
import { bookmarks, workspaces } from "~/lib/data/schema";

/**
 * validate_workspace_ownership trigger: workspace-less bookmarks are a
 * first-class app state (unsorted list, move-to-"null"), so both INSERT and
 * UPDATE with workspace_id IS NULL must pass the trigger. Regression guard
 * for the trigger rejecting NULL workspace_id.
 */
const AGENT_USER = "52a3cabd-90dd-4019-8267-b926ffd59a6e";
const FOREIGN_USER = "8256b5a2-2c49-4e30-afd1-671c183fb7c9";
const PREFIX = "drizzle-iso-";

const HAS_DB = Boolean(process.env.DATABASE_URL);

function insertAuthUser(id: string, email: string) {
  return getDb().execute(
    sql.raw(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current, reauthentication_token, phone_change_token)
       values ('00000000-0000-0000-0000-000000000000', '${id}', 'authenticated', 'authenticated', '${email}', crypt('password', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '', '', '', '', '', '', '')`,
    ),
  );
}

describe.skipIf(!HAS_DB)(
  "workspace-ownership trigger — NULL workspace allowed",
  () => {
    beforeAll(async () => {
      const db = getDb();
      const [defaultWs] = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(
          and(
            eq(workspaces.user_id, AGENT_USER),
            eq(workspaces.is_default, true),
          ),
        )
        .limit(1);
      if (!defaultWs)
        throw new Error(
          "Seed data missing: agent user has no default workspace",
        );

      await db.insert(bookmarks).values({
        user_id: AGENT_USER,
        workspace_id: defaultWs.id,
        url: `https://example.com/${PREFIX}null-ws-seed`,
        title: `${PREFIX}null-ws-seed`,
      });
    });

    afterAll(async () => {
      await getDb()
        .delete(bookmarks)
        .where(
          and(
            eq(bookmarks.user_id, AGENT_USER),
            like(bookmarks.url, `%${PREFIX}null-ws-seed%`),
          ),
        );
    });

    it("INSERT with NULL workspace_id succeeds", async () => {
      const db = getDb();
      await db.insert(bookmarks).values({
        user_id: AGENT_USER,
        workspace_id: null,
        url: `https://example.com/${PREFIX}null-ws-insert`,
        title: `${PREFIX}null-ws-insert`,
      });

      const [row] = await db
        .select({ id: bookmarks.id })
        .from(bookmarks)
        .where(
          eq(bookmarks.url, `https://example.com/${PREFIX}null-ws-insert`),
        );
      expect(row?.id).toBeDefined();
    });

    it("UPDATE to NULL workspace_id succeeds (move to unsorted)", async () => {
      const db = getDb();
      const [seed] = await db
        .select({ id: bookmarks.id })
        .from(bookmarks)
        .where(eq(bookmarks.url, `https://example.com/${PREFIX}null-ws-seed`));
      if (!seed) throw new Error("fixture seed bookmark missing");

      const moved = await moveBookmarks(db, AGENT_USER, {
        ids: [seed.id],
        targetWorkspaceId: "null",
      });
      expect(moved).toMatchObject({
        success: true,
        data: { movedCount: 1, skippedCount: 0 },
      });

      const [after] = await db
        .select({ workspaceId: bookmarks.workspace_id })
        .from(bookmarks)
        .where(eq(bookmarks.id, seed.id));
      expect(after?.workspaceId).toBeNull();
    });

    it("still rejects a workspace owned by another user", async () => {
      const db = getDb();
      const [foreignWs] = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.user_id, FOREIGN_USER))
        .limit(1);
      if (!foreignWs)
        throw new Error("Seed data missing: foreign user has no workspaces");

      let threw = false;
      try {
        await db.execute(
          sql`insert into public.bookmarks (user_id, workspace_id, url)
              values ('${AGENT_USER}', '${foreignWs.id}', 'https://example.com/${PREFIX}cross-ws')
              on conflict do nothing`,
        );
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });
  },
);

describe.skipIf(!HAS_DB)("handle_new_user — username derivation", () => {
  const PROBE_IDS = [
    "55555555-5555-5555-5555-5555555555a1",
    "55555555-5555-5555-5555-5555555555a2",
    "55555555-5555-5555-5555-5555555555a3",
    "55555555-5555-5555-5555-5555555555a4",
  ] as const;

  afterAll(async () => {
    const db = getDb();
    const idList = PROBE_IDS.map((id) => `'${id}'`).join(", ");
    await db.execute(sql.raw(`delete from auth.users where id in (${idList})`));
  });

  it("lowercases, sanitizes, enforces min length, and suffixes on collision", async () => {
    // Mixed-case + dot local part → lowercased, dot stripped.
    await insertAuthUser(PROBE_IDS[0], "John.Doe@x.com");
    // Short local part (below the 3-char minimum) → "user" fallback.
    await insertAuthUser(PROBE_IDS[1], "ab@x.com");
    // Collision with the sanitized first probe ("johndoe").
    await insertAuthUser(PROBE_IDS[2], "john.doe@y.com");
    // Collision with the fallback ("user").
    await insertAuthUser(PROBE_IDS[3], "cd@y.com");

    const rows = await getDb().execute<{ id: string; username: string }>(
      sql.raw(
        `select id, username from public.profiles
           where id in (${PROBE_IDS.map((id) => `'${id}'`).join(", ")})
           order by id`,
      ),
    );
    const byId = new Map(rows.map((r) => [r.id, r.username]));
    expect(byId.get(PROBE_IDS[0])).toBe("johndoe");
    expect(byId.get(PROBE_IDS[1])).toBe("user");
    expect(byId.get(PROBE_IDS[2])).toBe("johndoe1");
    expect(byId.get(PROBE_IDS[3])).toBe("user1");

    for (const username of byId.values()) {
      expect(username).toMatch(/^[a-z0-9_]{3,30}$/);
    }
  });
});
