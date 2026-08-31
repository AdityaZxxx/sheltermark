import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";

import type { DrizzleDb } from "~/lib/data/db";
import type { BackupProvider } from "~/lib/schemas/backup.schema";

import { dbError, type ActionResult } from "~/lib/action-result";
import { cloudConnections } from "~/lib/data/schema";
import { backupProviderSchema } from "~/lib/schemas/backup.schema";

export interface CloudConnectionRow {
  id: string;
  user_id: string;
  provider: BackupProvider;
  account_email: string | null;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  last_backup_at: string | null;
  last_backup_status: "success" | "failed" | null;
  provider_folder_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * SECURITY: Drizzle connects with the service-role credential and BYPASSES
 * ROW LEVEL SECURITY. Every query here enforces `user_id` ownership
 * explicitly (same posture as the other repositories).
 */

function toRow(row: typeof cloudConnections.$inferSelect): CloudConnectionRow {
  // SAFETY: provider/status values are CHECK-constrained at the database
  // level to the exact literals these schemas enumerate.
  return {
    id: row.id,
    user_id: row.user_id,
    provider: backupProviderSchema.parse(row.provider),
    account_email: row.account_email,
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    token_expires_at: row.token_expires_at,
    last_backup_at: row.last_backup_at,
    last_backup_status:
      row.last_backup_status === "success" ||
      row.last_backup_status === "failed"
        ? row.last_backup_status
        : null,
    provider_folder_id: row.provider_folder_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getCloudConnection(
  db: DrizzleDb,
  userId: string,
  provider: BackupProvider,
): Promise<ActionResult<CloudConnectionRow | null>> {
  try {
    const rows = await db
      .select()
      .from(cloudConnections)
      .where(
        and(
          eq(cloudConnections.user_id, userId),
          eq(cloudConnections.provider, provider),
        ),
      )
      .limit(1);
    const first = rows[0];
    return { success: true, data: first ? toRow(first) : null };
  } catch (cause) {
    return dbError("Cloud connection", cause);
  }
}

export async function listCloudConnections(
  db: DrizzleDb,
  userId: string,
): Promise<ActionResult<CloudConnectionRow[]>> {
  try {
    const rows = await db
      .select()
      .from(cloudConnections)
      .where(eq(cloudConnections.user_id, userId))
      // Newest updated first: the UI takes [0] as the active connection and
      // requireConnection picks the most recently updated one — both must
      // agree, and unordered SELECT gives no such guarantee.
      .orderBy(desc(cloudConnections.updated_at));
    return { success: true, data: rows.map(toRow) };
  } catch (cause) {
    return dbError("Cloud connection", cause);
  }
}

interface UpsertCloudConnectionInput {
  provider: BackupProvider;
  accountEmail: string | null;
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiresAt?: string | null;
}

export async function upsertCloudConnection(
  db: DrizzleDb,
  userId: string,
  input: UpsertCloudConnectionInput,
): Promise<ActionResult<CloudConnectionRow>> {
  const now = new Date().toISOString();
  try {
    const rows = await db
      .insert(cloudConnections)
      .values({
        user_id: userId,
        provider: input.provider,
        account_email: input.accountEmail,
        access_token: input.accessToken,
        refresh_token: input.refreshToken ?? null,
        token_expires_at: input.tokenExpiresAt ?? null,
        updated_at: now,
      })
      .onConflictDoUpdate({
        target: [cloudConnections.user_id, cloudConnections.provider],
        set: {
          account_email: input.accountEmail,
          access_token: input.accessToken,
          refresh_token: input.refreshToken ?? null,
          token_expires_at: input.tokenExpiresAt ?? null,
          updated_at: now,
        },
      })
      .returning();
    const first = rows[0];
    if (!first) {
      return {
        success: false,
        error: "Failed to save cloud connection",
      };
    }
    return { success: true, data: toRow(first) };
  } catch (cause) {
    return dbError("Cloud connection", cause);
  }
}

interface UpdateConnectionTokensInput {
  accessToken: string;
  /** New refresh token; when omitted the stored one is kept (Google reuses). */
  refreshToken?: string | null;
  tokenExpiresAt?: string | null;
}

export async function updateConnectionTokens(
  db: DrizzleDb,
  userId: string,
  provider: BackupProvider,
  input: UpdateConnectionTokensInput,
): Promise<ActionResult<null>> {
  const now = new Date().toISOString();
  try {
    await db
      .update(cloudConnections)
      .set({
        access_token: input.accessToken,
        // A provider that didn't rotate must not wipe the stored refresh
        // token — keep the column's existing value in that case.
        refresh_token:
          input.refreshToken ?? sql`${cloudConnections.refresh_token}`,
        token_expires_at: input.tokenExpiresAt ?? null,
        updated_at: now,
      })
      .where(
        and(
          eq(cloudConnections.user_id, userId),
          eq(cloudConnections.provider, provider),
        ),
      );
    return { success: true, data: null };
  } catch (cause) {
    return dbError("Cloud connection", cause);
  }
}

/** Pin the resolved backups-folder reference (Drive file id) on the connection. */
export async function setProviderFolderId(
  db: DrizzleDb,
  userId: string,
  provider: BackupProvider,
  folderId: string,
): Promise<ActionResult<null>> {
  try {
    await db
      .update(cloudConnections)
      .set({
        provider_folder_id: folderId,
        updated_at: new Date().toISOString(),
      })
      .where(
        and(
          eq(cloudConnections.user_id, userId),
          eq(cloudConnections.provider, provider),
        ),
      );
    return { success: true, data: null };
  } catch (cause) {
    return dbError("Cloud connection", cause);
  }
}

export async function markBackupOutcome(
  db: DrizzleDb,
  userId: string,
  provider: BackupProvider,
  status: "success" | "failed",
  at = new Date().toISOString(),
): Promise<ActionResult<null>> {
  try {
    await db
      .update(cloudConnections)
      .set({
        last_backup_at: at,
        last_backup_status: status,
        updated_at: at,
      })
      .where(
        and(
          eq(cloudConnections.user_id, userId),
          eq(cloudConnections.provider, provider),
        ),
      );
    return { success: true, data: null };
  } catch (cause) {
    return dbError("Cloud connection", cause);
  }
}

export async function deleteCloudConnection(
  db: DrizzleDb,
  userId: string,
  provider: BackupProvider,
): Promise<ActionResult<null>> {
  try {
    await db
      .delete(cloudConnections)
      .where(
        and(
          eq(cloudConnections.user_id, userId),
          eq(cloudConnections.provider, provider),
        ),
      );
    return { success: true, data: null };
  } catch (cause) {
    return dbError("Cloud connection", cause);
  }
}
