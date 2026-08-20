import { describe, expect, it } from "bun:test";

import type { AuditEventInput } from "~/lib/audit";

import { buildAuditEventRow, cronActor } from "~/lib/audit";

const valid: AuditEventInput = {
  actorType: "cron",
  actorId: "cron:sync-feeds#42",
  action: "feed_sync.run",
  resourceType: "feed",
  reason: "Scheduled sync across all users' feeds",
  metadata: { synced: 3, errorCount: 0, success: true },
};

describe("buildAuditEventRow", () => {
  it("maps a valid event to the database row shape", () => {
    const row = buildAuditEventRow(valid);
    expect(row).toEqual({
      actor_type: "cron",
      actor_id: "cron:sync-feeds#42",
      action: "feed_sync.run",
      resource_type: "feed",
      resource_id: null,
      reason: "Scheduled sync across all users' feeds",
      metadata: { synced: 3, errorCount: 0, success: true },
    });
  });

  it("defaults metadata to an empty object and keeps an optional resourceId", () => {
    const row = buildAuditEventRow({
      ...valid,
      metadata: undefined,
      resourceId: "8256b5a2-2c49-4e30-afd1-671c183fb7c9",
    });
    expect(row.metadata).toEqual({});
    expect(row.resource_id).toBe("8256b5a2-2c49-4e30-afd1-671c183fb7c9");
  });

  it("rejects an unknown actor type", () => {
    expect(() =>
      // @ts-expect-error — "admin" is deliberately not a valid actor type
      buildAuditEventRow({ ...valid, actorType: "admin" }),
    ).toThrow();
  });

  it("rejects non-namespaced action names", () => {
    expect(() =>
      buildAuditEventRow({ ...valid, action: "Feed Sync Run!" }),
    ).toThrow();
  });

  it("rejects reasons under 3 or over 500 characters", () => {
    expect(() => buildAuditEventRow({ ...valid, reason: "hi" })).toThrow();
    expect(() =>
      buildAuditEventRow({ ...valid, reason: "x".repeat(501) }),
    ).toThrow();
  });

  it("rejects metadata keys that look like user content", () => {
    const blockedKeys = [
      "url",
      "bookmarkUrl",
      "title",
      "pageTitle",
      "note",
      "content",
      "summary",
      "description",
      "email",
      "userName",
      "bio",
      "faviconUrl",
      "ogImageUrl",
      "password",
      "apiToken",
      "secretKey",
      "tag",
      "tagName",
      "query",
      "address",
      "phone",
    ];
    for (const key of blockedKeys) {
      expect(() =>
        buildAuditEventRow({ ...valid, metadata: { [key]: "value" } }),
      ).toThrow("must not reference user content");
    }
  });

  it("rejects non-primitive metadata values", () => {
    expect(() =>
      buildAuditEventRow({
        ...valid,
        // @ts-expect-error — exercised deliberately at the validation boundary
        metadata: { nested: { url: "https://example.com" } },
      }),
    ).toThrow();
    expect(() =>
      buildAuditEventRow({
        ...valid,
        // @ts-expect-error — exercised deliberately at the validation boundary
        metadata: { items: ["https://example.com"] },
      }),
    ).toThrow();
  });

  it("allows count- and scope-shaped metadata keys", () => {
    const row = buildAuditEventRow({
      ...valid,
      metadata: {
        removedBookmarks: 12,
        removedWorkspaces: 1,
        affectedUsers: 4,
        workspaceId: "8256b5a2-2c49-4e30-afd1-671c183fb7c9",
        success: true,
      },
    });
    expect(row.metadata.removedBookmarks).toBe(12);
  });
});

describe("cronActor", () => {
  it("embeds the GitHub run id when present, else falls back to local", () => {
    const original = process.env.GITHUB_RUN_ID;
    try {
      process.env.GITHUB_RUN_ID = "12345";
      expect(cronActor("sync-feeds")).toBe("cron:sync-feeds#12345");
      delete process.env.GITHUB_RUN_ID;
      expect(cronActor("check-urls")).toBe("cron:check-urls#local");
    } finally {
      if (original !== undefined) {
        process.env.GITHUB_RUN_ID = original;
      }
    }
  });
});
