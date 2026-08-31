"use client";

import {
  CloudArrowDownIcon,
  CloudArrowUpIcon,
  PlugsIcon,
  SpinnerIcon,
} from "@phosphor-icons/react";
import { useState } from "react";

import type { BackupProvider } from "~/lib/schemas/backup.schema";

import { DropboxIcon } from "~/components/auth/dropbox-icon";
import { GoogleDriveIcon } from "~/components/auth/google-drive-icon";
import { Button } from "~/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldSet,
  FieldLegend,
} from "~/components/ui/field";
import {
  useBackupNow,
  useDisconnectProvider,
} from "~/lib/mutations/backup.mutations";
import { useCloudBackupStatus } from "~/lib/queries/backup.queries";
import { formatRelativeTime } from "~/lib/utils/format";

import { RestoreDialog } from "./restore-dialog";

// OneDrive is hidden until MS_CLIENT_ID/SECRET credentials exist; the
// backend (schema, adapter, authorize route) stays wired so re-enabling
// is a one-line change here.
const PROVIDERS = [
  { id: "google_drive", label: "Google Drive", Icon: GoogleDriveIcon },
  { id: "dropbox", label: "Dropbox", Icon: DropboxIcon },
] as const satisfies {
  id: BackupProvider;
  label: string;
  Icon: (props: { className?: string }) => React.ReactNode;
}[];

function ProviderLabel({ provider }: { provider: BackupProvider }) {
  const entry = PROVIDERS.find((p) => p.id === provider);
  if (!entry) return provider;
  const { Icon, label } = entry;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
}

export function CloudBackupSection() {
  const { data: statuses, isLoading, isError } = useCloudBackupStatus();
  const [restoreOpen, setRestoreOpen] = useState(false);
  const backupNowMutation = useBackupNow();
  const disconnectMutation = useDisconnectProvider();

  const connection = statuses?.[0] ?? null;

  return (
    <FieldSet>
      <FieldLegend variant="label">Cloud Backup</FieldLegend>

      {isLoading ? (
        <FieldDescription>Loading backup status…</FieldDescription>
      ) : isError ? (
        <FieldDescription>
          Unable to load backup status. Reopen Settings to try again.
        </FieldDescription>
      ) : connection ? (
        <Field>
          <div className="flex min-w-0 items-center gap-2">
            <p className="min-w-0 truncate text-sm font-medium">
              <ProviderLabel provider={connection.provider} />
              {connection.accountEmail ? (
                <span className="text-muted-foreground">
                  {" "}
                  {connection.accountEmail}
                </span>
              ) : null}
            </p>
          </div>
          <FieldDescription>
            {connection.lastBackupAt
              ? `Last backup ${formatRelativeTime(connection.lastBackupAt)} · ${
                  connection.lastBackupStatus === "failed"
                    ? "failed"
                    : "successful"
                }`
              : "No backups yet"}
          </FieldDescription>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="min-w-28 flex-1 gap-2"
              onClick={() => backupNowMutation.mutate()}
              disabled={backupNowMutation.isPending}
            >
              {backupNowMutation.isPending ? (
                <SpinnerIcon className="size-4 shrink-0 animate-spin" />
              ) : (
                <CloudArrowUpIcon className="size-4 shrink-0" />
              )}
              Back up now
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-w-28 flex-1 gap-2"
              onClick={() => setRestoreOpen(true)}
            >
              <CloudArrowDownIcon className="size-4 shrink-0" />
              Restore
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="self-start text-muted-foreground"
            onClick={() => disconnectMutation.mutate(connection.provider)}
            disabled={disconnectMutation.isPending}
          >
            <PlugsIcon className="size-4 shrink-0" />
            Disconnect
          </Button>
        </Field>
      ) : (
        <Field>
          <FieldDescription>
            Save a copy of your bookmarks to your own cloud storage in
            Sheltermark/Backups/.
          </FieldDescription>
          <div className="flex flex-wrap gap-2">
            {PROVIDERS.map(({ id, label, Icon }) => (
              <a
                key={id}
                href={`/api/backup/authorize/${id}`}
                className="min-w-28 flex-1"
              >
                <Button variant="outline" size="sm" className="w-full gap-2">
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{label}</span>
                </Button>
              </a>
            ))}
          </div>
        </Field>
      )}

      <RestoreDialog open={restoreOpen} onOpenChange={setRestoreOpen} />
    </FieldSet>
  );
}
