"use client";

import { FolderSimpleIcon } from "@phosphor-icons/react";

import type { FolderNode } from "~/lib/import/folder-filter";

import { Checkbox } from "~/components/ui/checkbox";
import { FOLDER_PATH_SEPARATOR } from "~/lib/import/folder-filter";
import { cn } from "~/lib/utils";

interface FolderTreeProps {
  folders: FolderNode[];
  selectedFolders: Set<string>;
  /** Currently displayed bookmark count after folder filtering. */
  selectedCount: number;
  /** Total bookmarks across all folders (before filtering). */
  totalCount: number;
  onToggle: (path: string[]) => void;
}

export function FolderTree({
  folders,
  selectedFolders,
  selectedCount,
  totalCount,
  onToggle,
}: FolderTreeProps) {
  const allSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
        <Checkbox
          checked={allSelected}
          indeterminate={!allSelected && selectedCount > 0}
          // Empty path means "all folders": the hook treats it as a
          // select-all/none toggle, not a literal folder.
          onCheckedChange={() => onToggle([])}
          aria-label="Toggle all folders"
        />
        <span className="text-xs text-muted-foreground tabular-nums">
          {allSelected
            ? `All folders · ${totalCount} bookmarks`
            : `${selectedCount} of ${totalCount} bookmarks selected`}
        </span>
      </div>

      <div className="max-h-56 overflow-y-auto p-1.5">
        {folders.map((folder) => {
          const key = folder.path.join(FOLDER_PATH_SEPARATOR);
          const isChecked = selectedFolders.has(key);
          const depth = folder.path.length;
          const label =
            folder.path.length === 0
              ? "(Top level)"
              : (folder.path[folder.path.length - 1] ?? "");

          return (
            <div
              key={key || "root"}
              className="flex items-center gap-2 rounded-md px-1.5 py-1.5 hover:bg-muted/50"
              style={{ paddingInlineStart: `${depth * 16 + 6}px` }}
            >
              <Checkbox
                checked={isChecked}
                onCheckedChange={() => onToggle(folder.path)}
                aria-label={`Toggle folder ${label}`}
              />
              <FolderSimpleIcon
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-1.5 text-xs text-muted-foreground tabular-nums",
                  isChecked ? "bg-muted" : "opacity-60",
                )}
              >
                {folder.totalCount}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
