import { afterAll, describe, expect, it } from "bun:test";
import "dotenv/config";

import type { BackupProvider } from "~/lib/schemas/backup.schema";

import { getDb } from "~/lib/data/db";
import {
  deleteCloudConnection,
  getCloudConnection,
  listCloudConnections,
  markBackupOutcome,
  updateConnectionTokens,
  upsertCloudConnection,
} from "~/lib/data/repositories/cloud-connection.repository";

/**
 * Live-database cross-user isolation tests for the cloud-connection
 * repository. Same posture as the bookmark/workspace suites: service-role
 * connection bypasses RLS, so every function must enforce ownership itself.
 * Footprint: rows for the seeded agent user only, deleted in afterAll.
 */
const AGENT_USER = "52a3cabd-90dd-4019-8267-b926ffd59a6e";
const FOREIGN_USER = "8256b5a2-2c49-4e30-afd1-671c183fb7c9";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)(
  "cloud-connection repository — isolation suite",
  () => {
    const db = getDb();
    const usedProviders: BackupProvider[] = [];

    async function cleanup() {
      for (const provider of usedProviders) {
        await deleteCloudConnection(db, AGENT_USER, provider);
      }
    }

    afterAll(async () => {
      await cleanup();
    });

    it("upserts and reads back a connection scoped to the user", async () => {
      const result = await upsertCloudConnection(db, AGENT_USER, {
        provider: "google_drive",
        accountEmail: "agent@example.com",
        accessToken: "token-1",
        refreshToken: "refresh-1",
        tokenExpiresAt: "2026-09-01T00:00:00Z",
      });
      expect(result.success).toBe(true);
      usedProviders.push("google_drive");

      const read = await getCloudConnection(db, AGENT_USER, "google_drive");
      expect(read.success).toBe(true);
      if (read.success && read.data) {
        expect(read.data.account_email).toBe("agent@example.com");
        expect(read.data.access_token).toBe("token-1");
      }
    });

    it("upsert replaces tokens on reconnect", async () => {
      const result = await upsertCloudConnection(db, AGENT_USER, {
        provider: "google_drive",
        accountEmail: "agent@example.com",
        accessToken: "token-2",
        refreshToken: "refresh-2",
        tokenExpiresAt: null,
      });
      expect(result.success).toBe(true);

      const read = await getCloudConnection(db, AGENT_USER, "google_drive");
      if (read.success && read.data) {
        expect(read.data.access_token).toBe("token-2");
        expect(read.data.refresh_token).toBe("refresh-2");
      }
    });

    it("foreign user cannot see the agent's connection", async () => {
      const foreign = await getCloudConnection(
        db,
        FOREIGN_USER,
        "google_drive",
      );
      expect(foreign.success).toBe(true);
      if (foreign.success) {
        expect(foreign.data).toBeNull();
      }
    });

    it("token update keeps stored refresh token when provider didn't rotate", async () => {
      const updated = await updateConnectionTokens(
        db,
        AGENT_USER,
        "google_drive",
        { accessToken: "token-3", refreshToken: null },
      );
      expect(updated.success).toBe(true);

      const read = await getCloudConnection(db, AGENT_USER, "google_drive");
      if (read.success && read.data) {
        expect(read.data.access_token).toBe("token-3");
        expect(read.data.refresh_token).toBe("refresh-2");
      }
    });

    it("marks backup outcome on the owning user's row only", async () => {
      const marked = await markBackupOutcome(
        db,
        AGENT_USER,
        "google_drive",
        "success",
      );
      expect(marked.success).toBe(true);

      const read = await getCloudConnection(db, AGENT_USER, "google_drive");
      if (read.success && read.data) {
        expect(read.data.last_backup_status).toBe("success");
        expect(read.data.last_backup_at).not.toBeNull();
      }

      const foreign = await getCloudConnection(
        db,
        FOREIGN_USER,
        "google_drive",
      );
      if (foreign.success) {
        expect(foreign.data).toBeNull();
      }
    });

    it("delete removes only the owner's connection", async () => {
      await upsertCloudConnection(db, AGENT_USER, {
        provider: "dropbox",
        accountEmail: null,
        accessToken: "dbx",
        refreshToken: null,
        tokenExpiresAt: null,
      });
      usedProviders.push("dropbox");

      const removed = await deleteCloudConnection(db, AGENT_USER, "dropbox");
      expect(removed.success).toBe(true);

      const read = await getCloudConnection(db, AGENT_USER, "dropbox");
      if (read.success) {
        expect(read.data).toBeNull();
      }
    });

    it("lists only the caller's connections", async () => {
      const mine = await listCloudConnections(db, AGENT_USER);
      const foreign = await listCloudConnections(db, FOREIGN_USER);
      expect(mine.success).toBe(true);
      expect(foreign.success).toBe(true);
      if (mine.success && foreign.success) {
        expect(foreign.data.every((c) => c.user_id === FOREIGN_USER)).toBe(
          true,
        );
        expect(mine.data.every((c) => c.user_id === AGENT_USER)).toBe(true);
      }
    });
  },
);
