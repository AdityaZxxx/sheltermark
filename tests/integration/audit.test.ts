import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { and, eq, inArray, like, lt, ne } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import type { AuditEventInput } from "~/lib/audit";

import {
  buildAuditEventRow,
  cronActor,
  insertAuditEvent,
  insertAuditEventSupabase,
} from "~/lib/audit";
import { getDb } from "~/lib/data/db";
import { auditEvents } from "~/lib/data/schema";

/**
 * Live-database integration suite for the privileged-access audit trail.
 * Verifies: (1) both transports persist validated rows, (2) RLS seals the
 * table against application users — anon can neither read nor write,
 * (3) service-role rows are invisible to anon even after insertion.
 *
 * Test rows carry the `audit_test.*` action prefix and a run-scoped actor id;
 * afterAll deletes exactly the inserted ids. Requires DATABASE_URL; skipped
 * in CI without it. Requires the audit_events migration to be applied.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);

const RUN_TAG = `test:audit#${randomUUID()}`;
const insertedIds: string[] = [];

function testEvent(
  action: string,
  extras?: Partial<Omit<AuditEventInput, "actorId" | "actorType" | "reason">>,
): AuditEventInput {
  return {
    actorType: "system",
    actorId: RUN_TAG,
    action: `audit_test.${action}`,
    resourceType: "audit",
    reason: "audit integration test row",
    ...extras,
  };
}

describe.skipIf(!HAS_DB)("audit trail — live database", () => {
  const db = getDb();

  async function fetchSingle(action: string) {
    const rows = await db
      .select()
      .from(auditEvents)
      .where(
        and(eq(auditEvents.actor_id, RUN_TAG), eq(auditEvents.action, action)),
      );
    expect(rows).toHaveLength(1);
    // Non-null: toHaveLength(1) above guarantees a single row.
    return rows[0]!;
  }

  beforeAll(async () => {
    // Reap leftovers from crashed earlier runs (test rows older than 10 minutes).
    const cutoff = new Date(Date.now() - 10 * 60 * 1000);
    await db
      .delete(auditEvents)
      .where(
        and(
          like(auditEvents.action, "audit_test.%"),
          ne(auditEvents.actor_id, RUN_TAG),
          lt(auditEvents.created_at, cutoff.toISOString()),
        ),
      );
  });

  afterAll(async () => {
    if (insertedIds.length > 0) {
      await db.delete(auditEvents).where(inArray(auditEvents.id, insertedIds));
    }
  });

  it("persists an event through the Drizzle transport and reads it back", async () => {
    await insertAuditEvent(db, {
      ...testEvent("drizzle_roundtrip"),
      metadata: { synced: 2, success: true },
    });

    const row = await fetchSingle("audit_test.drizzle_roundtrip");
    insertedIds.push(row.id);

    expect(row.actor_type).toBe("system");
    expect(row.resource_type).toBe("audit");
    expect(row.reason).toBe("audit integration test row");
    expect(row.resource_id).toBeNull();
    expect(row.metadata).toEqual({ synced: 2, success: true });
    expect(row.created_at).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/,
    );
  });

  it("persists an event through the supabase-js transport", async () => {
    const supabase = createClient(
      process.env.SUPABASE_URL ?? "",
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    );

    await insertAuditEventSupabase(supabase, {
      ...testEvent("supabase_roundtrip"),
      metadata: { removedBookmarks: 7, affectedUsers: 1 },
    });

    const row = await fetchSingle("audit_test.supabase_roundtrip");
    insertedIds.push(row.id);
    expect(row.metadata).toEqual({
      removedBookmarks: 7,
      affectedUsers: 1,
    });
  });

  it("seals the table from application users: anon can neither read nor write", async () => {
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    );

    const { data: visible, error: selectError } = await anon
      .from("audit_events")
      .select("id")
      .limit(1);

    expect(selectError).toBeNull();
    expect(visible ?? []).toEqual([]);

    const row = buildAuditEventRow(testEvent("anon_denied"));
    const { error: insertError } = await anon.from("audit_events").insert(row);
    expect(insertError).not.toBeNull();
  });

  it("rejects content-shaped events before they reach the database", async () => {
    expect(() =>
      buildAuditEventRow({
        ...testEvent("content_smuggling"),
        metadata: { bookmarkUrl: "https://private.example.com/page" },
      }),
    ).toThrow();

    const rows = await db
      .select({ id: auditEvents.id })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.actor_id, RUN_TAG),
          eq(auditEvents.action, "audit_test.content_smuggling"),
        ),
      );
    expect(rows).toHaveLength(0);
  });

  it("enforces structural constraints at the database level even without app validation", async () => {
    const supabase = createClient(
      process.env.SUPABASE_URL ?? "",
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    );

    const base = {
      actor_type: "system",
      actor_id: RUN_TAG,
      action: "audit_test.constraint_probe",
      resource_type: "audit",
      resource_id: null,
      reason: "constraint enforcement probe",
    };

    // An actor_id shaped like an email must be rejected by the CHECK, not by Zod.
    const emailActor = await supabase.from("audit_events").insert({
      ...base,
      actor_id: "developer:carol@example.com",
      metadata: {},
    });
    expect(emailActor.error).not.toBeNull();

    // A metadata string value containing a path must be rejected by the CHECK.
    const urlValue = await supabase.from("audit_events").insert({
      ...base,
      metadata: { file: "tmp/bookmark-export.json" },
    });
    expect(urlValue.error).not.toBeNull();

    const leftovers = await db
      .select({ id: auditEvents.id })
      .from(auditEvents)
      .where(eq(auditEvents.action, "audit_test.constraint_probe"));
    expect(leftovers).toHaveLength(0);
  });

  it("produces stable cron actor identities", () => {
    const original = process.env.GITHUB_RUN_ID;
    try {
      process.env.GITHUB_RUN_ID = "99001";
      expect(cronActor("sync-feeds")).toBe("cron:sync-feeds#99001");
    } finally {
      if (original !== undefined) {
        process.env.GITHUB_RUN_ID = original;
      } else {
        delete process.env.GITHUB_RUN_ID;
      }
    }
  });
});
