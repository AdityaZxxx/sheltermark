"use client";

import {
  CloudArrowDownIcon,
  CloudArrowUpIcon,
  CloudIcon,
  PlugsConnectedIcon,
  SpinnerIcon,
} from "@phosphor-icons/react";
import { useState } from "react";

import type { BackupProvider } from "~/lib/schemas/backup.schema";

import { Button } from "~/components/ui/button";
import { FieldDescription, FieldSet, FieldLegend } from "~/components/ui/field";
import {
  useBackupNow,
  useDisconnectProvider,
} from "~/lib/mutations/backup.mutations";
import { useCloudBackupStatus } from "~/lib/queries/backup.queries";
import { formatRelativeTime } from "~/lib/utils/format";

import { RestoreDialog } from "./restore-dialog";

const PROVIDER_LABELS = {
  google_drive: "Google Drive",
  dropbox: "Dropbox",
  onedrive: "OneDrive",
} as const satisfies Record<BackupProvider, string>;

export function CloudBackupSection() {
  const { data: statuses, isLoading } = useCloudBackupStatus();
  const [restoreOpen, setRestoreOpen] = useState(false);
  const backupNowMutation = useBackupNow();
  const disconnectMutation = useDisconnectProvider();

  const connection = statuses?.[0] ?? null;

  return (
    <FieldSet>
      <FieldLegend variant="label">Cloud Backup</FieldLegend>
      <FieldDescription>
        Automatically keeps a copy of your bookmarks in your own cloud storage
        (Sheltermark/Backups/). Uses the same format as JSON export.
      </FieldDescription>

      {isLoading ? (
        <FieldDescription>Loading backup status…</FieldDescription>
      ) : connection ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <PlugsConnectedIcon className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {PROVIDER_LABELS[connection.provider]}
                  {connection.accountEmail
                    ? ` · ${connection.accountEmail}`
                    : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {connection.lastBackupAt
                    ? `Last backup ${formatRelativeTime(connection.lastBackupAt)} · ${
                        connection.lastBackupStatus === "failed"
                          ? "failed"
                          : "successful"
                      }`
                    : "No backups yet"}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => disconnectMutation.mutate(connection.provider)}
              disabled={disconnectMutation.isPending}
            >
              Disconnect
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-2"
              onClick={() => backupNowMutation.mutate()}
              disabled={backupNowMutation.isPending}
            >
              {backupNowMutation.isPending ? (
                <SpinnerIcon className="size-4 animate-spin" />
              ) : (
                <CloudArrowUpIcon className="size-4" />
              )}
              Back Up Now
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-2"
              onClick={() => setRestoreOpen(true)}
            >
              <CloudArrowDownIcon className="size-4" />
              Restore…
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            Not connected. Choose a provider to enable backups.
          </p>
          <div className="flex gap-2">
            {(
              ["google_drive", "dropbox", "onedrive"] satisfies BackupProvider[]
            ).map((provider) => (
              <a
                key={provider}
                href={`/api/backup/authorize/${provider}`}
                className="flex-1"
              >
                <Button variant="outline" size="sm" className="w-full gap-2">
                  <CloudIcon className="size-4" />
                  {PROVIDER_LABELS[provider]}
                </Button>
              </a>
            ))}
          </div>
        </div>
      )}

      <RestoreDialog open={restoreOpen} onOpenChange={setRestoreOpen} />
    </FieldSet>
  );
}
