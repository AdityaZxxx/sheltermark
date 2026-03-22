"use client";

import { Checkbox } from "~/components/ui/checkbox";
import type { FolderNode } from "~/lib/import/folder-filter";
import { FOLDER_PATH_SEPARATOR } from "~/lib/import/folder-filter";
import { cn } from "~/lib/utils";

interface FolderTreeProps {
  folders: FolderNode[];
  /**
   * Currently-selected folder paths (joined by NUL). Empty set = all
   * selected (default).
   */
  selectedFolders: Set<string>;
  /** Currently displayed bookmark count after folder filtering. */
  selectedCount: number;
  /** Total bookmarks across all folders (before filtering). */
  totalCount: number;
  onToggle: (path: string[]) => void;
}

/**
 * Render a folder tree with checkboxes. Folders are passed in DFS order
 * with `path` carrying the breadcrumb. Indentation comes from `path.length`.
 *
 * Selection state is read directly from `selectedFolders`. A folder is
 * considered fully selected when `selectedFolders.size === 0` (default) or
 * its key is in the set; partially selected otherwise.
 */
export function FolderTree({
  folders,
  selectedFolders,
  selectedCount,
  totalCount,
  onToggle,
}: FolderTreeProps) {
  const allSelected = selectedFolders.size === 0;
  const allFoldersSelected = allSelected || selectedCount === totalCount;

  return (
    <div className="flex flex-col gap-1 max-h-64 overflow-y-auto rounded-md border border-border p-2">
      <div className="flex items-center gap-2 py-1 px-1">
        <Checkbox
          checked={allFoldersSelected}
          // Indeterminate when some-but-not-all selected
          indeterminate={!allFoldersSelected && selectedCount > 0}
          onCheckedChange={() => {
            // Top-level toggle: empty path means "all" in toggleFolder.
            // The hook interprets empty-path toggle as a full select-all
            // when not fully selected, or select-none when fully selected.
            onToggle([]);
          }}
          aria-label="Toggle all folders"
        />
        <span className="text-xs text-muted-foreground">
          {allFoldersSelected
            ? "All folders selected"
            : `${selectedCount} of ${totalCount} bookmarks selected`}
        </span>
      </div>

      <div className="border-t border-border" />

      {folders.map((folder) => {
        const key = folder.path.join(FOLDER_PATH_SEPARATOR);
        const isChecked = allSelected || selectedFolders.has(key);
        const depth = folder.path.length;
        const label =
          folder.path.length === 0
            ? "(Top level)"
            : (folder.path[folder.path.length - 1] ?? "");

        return (
          <div
            key={key || "root"}
            className={cn(
              "flex items-center gap-2 py-1 px-1 hover:bg-muted/30 rounded-sm",
            )}
            style={{ paddingLeft: `${depth * 16 + 4}px` }}
          >
            <Checkbox
              checked={isChecked}
              onCheckedChange={() => onToggle(folder.path)}
              aria-label={`Toggle folder ${label}`}
            />
            <span className="text-sm flex-1 truncate">{label}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {folder.totalCount}
            </span>
          </div>
        );
      })}
    </div>
  );
}
