"use client";

import {
  ArrowBendUpLeftIcon,
  CaretDownIcon,
  TrashIcon,
} from "@phosphor-icons/react";

import type { TrashedWorkspace } from "~/lib/schemas/workspace.schema";

import { BookmarkRow } from "~/components/trash/bookmark-row";
import { Button } from "~/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { formatRelativeTime } from "~/lib/format";
import { getPastelColor } from "~/lib/utils";

export function WorkspaceCard({
  workspace,
  selectedBmIds,
  onSelectBookmark,
  onRestore,
  onPermanentDelete,
  onRestoreBookmark,
  onPermanentDeleteBookmark,
  isSelectionMode,
  onSelectionModeToggle,
}: {
  workspace: TrashedWorkspace;
  selectedBmIds: Set<string>;
  onSelectBookmark: (id: string) => void;
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  onRestoreBookmark: (id: string) => void;
  onPermanentDeleteBookmark: (id: string) => void;
  isSelectionMode?: boolean;
  onSelectionModeToggle?: () => void;
}) {
  return (
    <Collapsible className="border border-border rounded-lg overflow-hidden bg-card transition-shadow hover:shadow-sm">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <CollapsibleTrigger className="group/trigger flex items-center gap-3 min-w-0 text-left transition-colors hover:opacity-70">
          <CaretDownIcon className="size-4 text-muted-foreground shrink-0 transition-transform duration-200 -rotate-90 group-data-[panel-open]/trigger:rotate-0" />
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: getPastelColor(workspace.id) }}
          />
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-sm font-medium truncate">{workspace.name}</p>
            {workspace.bookmarks.length > 0 && (
              <span className="shrink-0 inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
                {workspace.bookmarks.length}
              </span>
            )}
          </div>
        </CollapsibleTrigger>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="text-xs text-muted-foreground mr-1"
            suppressHydrationWarning
          >
            {workspace.deleted_at
              ? formatRelativeTime(workspace.deleted_at)
              : "recently"}
          </span>
          <div className="flex sm:hidden items-center gap-1">
            <Button
              variant="outline"
              size="icon-xs"
              onClick={() => onRestore(workspace.id)}
              title="Restore workspace"
            >
              <ArrowBendUpLeftIcon className="size-2.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => onPermanentDelete(workspace.id)}
              className="text-destructive hover:text-destructive"
              title="Delete forever"
            >
              <TrashIcon className="size-2.5" />
            </Button>
          </div>
          <div className="hidden sm:flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRestore(workspace.id)}
            >
              <ArrowBendUpLeftIcon className="size-3 sm:mr-1.5" />
              <span>Restore</span>
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onPermanentDelete(workspace.id)}
              className="text-destructive hover:text-destructive"
              title="Delete forever"
            >
              <TrashIcon className="size-3" />
            </Button>
          </div>
        </div>
      </div>
      <CollapsibleContent className="overflow-hidden">
        {workspace.bookmarks.length > 0 ? (
          <div className="border-t border-border divide-y divide-border">
            {workspace.bookmarks.map((bm) => (
              <BookmarkRow
                key={bm.id}
                bookmark={bm}
                isSelected={selectedBmIds.has(bm.id)}
                onSelect={onSelectBookmark}
                onRestore={onRestoreBookmark}
                onPermanentDelete={onPermanentDeleteBookmark}
                showCheckbox={isSelectionMode}
                onSelectionModeToggle={onSelectionModeToggle}
              />
            ))}
          </div>
        ) : (
          <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
            No bookmarks in this workspace
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
