"use server";

import { z } from "zod";

import type { ActionResult } from "~/lib/action-result";
import type {
  BackupFileMeta,
  CloudConnectionRow,
  RestorePreview,
  RestoreResult,
} from "~/lib/backup/service";
import type { BackupProvider } from "~/lib/schemas/backup.schema";

import { requireAuth } from "~/lib/auth";
import {
  listBackups as listBackupsService,
  previewRestore,
  restoreBackup,
  runBackup,
} from "~/lib/backup/service";
import { getDb } from "~/lib/data/db";
import {
  deleteCloudConnection,
  listCloudConnections,
  markBackupOutcome,
} from "~/lib/data/repositories/cloud-connection.repository";
import {
  backupProviderSchema,
  restoreOptionsSchema,
} from "~/lib/schemas/backup.schema";

export interface CloudBackupStatus {
  provider: BackupProvider;
  accountEmail: string | null;
  lastBackupAt: string | null;
  lastBackupStatus: "success" | "failed" | null;
}

/**
 * Auth gate + resolve the caller's active cloud connection. v1 uses the
 * most recently updated connection when several are connected.
 */
async function requireConnection(
  db: ReturnType<typeof getDb>,
  userId: string,
): Promise<
  | { ok: true; connection: CloudConnectionRow }
  | { ok: false; failure: ActionResult<never> }
> {
  const connections = await listCloudConnections(db, userId);
  if (!connections.success) {
    return { ok: false, failure: connections };
  }
  const connection = connections.data.toSorted((a, b) =>
    b.updated_at.localeCompare(a.updated_at),
  )[0];
  if (!connection) {
    return {
      ok: false,
      failure: { success: false, error: "Connect a cloud provider first." },
    };
  }
  return { ok: true, connection };
}

/** Public view of connections: no tokens, only display state. */
export async function getCloudBackupStatus(): Promise<
  ActionResult<CloudBackupStatus[]>
> {
  const { user } = await requireAuth();
  const result = await listCloudConnections(getDb(), user.id);
  if (!result.success) return result;
  return {
    success: true,
    data: result.data.map((c) => ({
      provider: c.provider,
      accountEmail: c.account_email,
      lastBackupAt: c.last_backup_at,
      lastBackupStatus: c.last_backup_status,
    })),
  };
}

export async function disconnectProvider(
  providerInput: BackupProvider,
): Promise<ActionResult<null>> {
  const validated = backupProviderSchema.safeParse(providerInput);
  if (!validated.success) {
    return { success: false, error: "Unknown provider." };
  }
  const { user } = await requireAuth();
  return deleteCloudConnection(getDb(), user.id, validated.data);
}

export async function backupNow(): Promise<ActionResult<null>> {
  const { user } = await requireAuth();
  const db = getDb();

  const active = await requireConnection(db, user.id);
  if (!active.ok) return active.failure;

  const outcome = await runBackup(db, active.connection);
  // Record status on the connection regardless of outcome so the UI can
  // show the last attempt's result.
  await markBackupOutcome(
    db,
    user.id,
    active.connection.provider,
    outcome.success ? "success" : "failed",
  );
  if (!outcome.success) return outcome;
  return { success: true, data: null };
}

export async function listProviderBackups(): Promise<
  ActionResult<BackupFileMeta[]>
> {
  const { user } = await requireAuth();
  const db = getDb();

  const active = await requireConnection(db, user.id);
  if (!active.ok) return active.failure;
  return listBackupsService(db, active.connection);
}

export async function previewBackupRestore(
  fileId: string,
): Promise<ActionResult<RestorePreview>> {
  const validated = z.string().min(1).safeParse(fileId);
  if (!validated.success) {
    return { success: false, error: "Invalid backup selection." };
  }
  const { user } = await requireAuth();
  const db = getDb();

  const active = await requireConnection(db, user.id);
  if (!active.ok) return active.failure;
  return previewRestore(db, active.connection, validated.data);
}

export async function restoreFromBackup(
  options: z.infer<typeof restoreOptionsSchema>,
): Promise<ActionResult<RestoreResult>> {
  const validated = restoreOptionsSchema.safeParse(options);
  if (!validated.success) {
    return { success: false, error: "Invalid restore options." };
  }
  const { user } = await requireAuth();
  const db = getDb();

  const active = await requireConnection(db, user.id);
  if (!active.ok) return active.failure;
  return restoreBackup(db, active.connection, validated.data.fileId, {
    duplicateStrategy: validated.data.duplicateStrategy,
  });
}
