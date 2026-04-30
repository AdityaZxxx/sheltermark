"use client";

import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";
import { exportBookmarks } from "~/app/action/export";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useWorkspaces } from "~/hooks/use-workspaces";
import { getPastelColor } from "~/lib/utils";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const { workspaces } = useWorkspaces();
  const [format, setFormat] = useState<"json" | "csv">("json");
  const [workspaceId, setWorkspaceId] = useState<string | "all">("all");
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportBookmarks({
        format,
        workspaceId: workspaceId === "all" ? undefined : workspaceId,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

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
      onOpenChange(false);
    } catch {
      toast.error("Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col max-h-[95vh]">
        <DialogHeader>
          <DialogTitle>Export Bookmarks</DialogTitle>
          <DialogDescription>
            Download your bookmarks in JSON or CSV format.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6 py-4">
          <div className="flex flex-col gap-3">
            <Label className="text-xs font-medium">Format</Label>
            <RadioGroup
              value={format}
              onValueChange={(value) => setFormat(value as "json" | "csv")}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="json" id="format-json" />
                <Label
                  htmlFor="format-json"
                  className="font-normal cursor-pointer"
                >
                  JSON
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="csv" id="format-csv" />
                <Label
                  htmlFor="format-csv"
                  className="font-normal cursor-pointer"
                >
                  CSV
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex flex-col gap-3">
            <Label className="text-xs font-medium">Workspace</Label>
            <Select
              value={workspaceId}
              onValueChange={(value) => setWorkspaceId(value as "all" | string)}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {workspaceId === "all" ? (
                    "All Workspaces"
                  ) : (
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: getPastelColor(workspaceId) }}
                      />
                      <span className="truncate">
                        {workspaces.find((ws) => ws.id === workspaceId)?.name}
                      </span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Workspaces</SelectItem>
                {workspaces.map((ws) => (
                  <SelectItem key={ws.id} value={ws.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: getPastelColor(ws.id) }}
                      />
                      <span className="truncate">{ws.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="gap-2"
          >
            {isExporting ? (
              "Exporting..."
            ) : (
              <>
                <DownloadSimpleIcon className="size-4" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
