"use client";

import {
  BracketsCurlyIcon,
  DownloadSimpleIcon,
  FileArrowDownIcon,
  SpinnerIcon,
  TableIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";

import { exportBookmarks } from "~/app/action/export.action";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { FieldError, FieldLegend, FieldSet } from "~/components/ui/field";
import { RadioGroup } from "~/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useWorkspaces } from "~/hooks/use-workspaces";
import { getPastelColor } from "~/lib/utils";

import { RadioCard } from "./radio-card";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ExportFormat = "json" | "csv";

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const { workspaces } = useWorkspaces();
  const [format, setFormat] = useState<ExportFormat>("json");
  const [workspaceId, setWorkspaceId] = useState<string | "all">("all");
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = (next: boolean) => {
    if (next) setError(null);
    onOpenChange(next);
  };

  const selectedWorkspace =
    workspaceId === "all"
      ? null
      : (workspaces.find((ws) => ws.id === workspaceId) ?? null);

  const exportCount =
    workspaceId === "all"
      ? workspaces.reduce((sum, ws) => sum + (ws.bookmarks_count ?? 0), 0)
      : (selectedWorkspace?.bookmarks_count ?? 0);

  const filename = `sheltermark-export-${formatDate(new Date())}.${format}`;

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    try {
      const result = await exportBookmarks({
        format,
        workspaceId: workspaceId === "all" ? undefined : workspaceId,
      });

      if (result.success) {
        const blob = new Blob([result.data.content], {
          type: result.data.contentType,
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.data.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success(`Exported ${result.data.filename}`);
        handleOpenChange(false);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Export failed. Please try again.");
    }
    setIsExporting(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border px-5 pt-5 pb-4">
          <DialogTitle>Export Bookmarks</DialogTitle>
          <DialogDescription>
            Download a copy of your bookmarks for backup or moving elsewhere.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
          <FieldSet className="gap-3">
            <FieldLegend variant="label">Format</FieldLegend>
            <RadioGroup
              value={format}
              onValueChange={(value) => {
                if (value === "json" || value === "csv") setFormat(value);
              }}
              className="grid gap-2"
            >
              <RadioCard
                id="format-json"
                value="json"
                title="JSON"
                badge={
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                    Recommended
                  </span>
                }
                description="Full backup — workspaces and tags preserved. Re-import any time."
                icon={
                  <BracketsCurlyIcon className="size-4" aria-hidden="true" />
                }
              />
              <RadioCard
                id="format-csv"
                value="csv"
                title="CSV"
                description="Flat list for spreadsheets. No workspace structure."
                icon={<TableIcon className="size-4" aria-hidden="true" />}
              />
            </RadioGroup>
          </FieldSet>

          <FieldSet className="gap-3">
            <FieldLegend variant="label">Workspace</FieldLegend>
            <Select
              id="export-workspace-select"
              value={workspaceId}
              onValueChange={(value) => {
                if (value !== null) setWorkspaceId(value);
              }}
            >
              <SelectTrigger aria-label="Workspace" className="w-full">
                <SelectValue>
                  {workspaceId === "all" ? (
                    "All workspaces"
                  ) : (
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor: getPastelColor(workspaceId),
                        }}
                      />
                      <span className="truncate">
                        {workspaces.find((ws) => ws.id === workspaceId)?.name}
                      </span>
                    </span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All workspaces</SelectItem>
                {workspaces.map((ws) => (
                  <SelectItem key={ws.id} value={ws.id}>
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: getPastelColor(ws.id) }}
                      />
                      <span className="truncate">{ws.name}</span>
                      <span className="ml-auto pl-2 text-xs text-muted-foreground tabular-nums">
                        {ws.bookmarks_count ?? 0}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldSet>

          <div
            aria-live="polite"
            className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <FileArrowDownIcon className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-xs" title={filename}>
                {filename}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {exportCount} bookmark{exportCount === 1 ? "" : "s"}
                {selectedWorkspace
                  ? ` in ${selectedWorkspace.name}`
                  : " across all workspaces"}
              </p>
            </div>
          </div>

          <FieldError errors={error ? [{ message: error }] : undefined} />
        </div>

        <DialogFooter className="flex-row justify-end border-t border-border px-5 py-4">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="gap-1.5"
          >
            {isExporting ? (
              <>
                <SpinnerIcon
                  className="size-4 motion-safe:animate-spin"
                  aria-hidden="true"
                />
                Exporting…
              </>
            ) : (
              <>
                <DownloadSimpleIcon className="size-4" aria-hidden="true" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
