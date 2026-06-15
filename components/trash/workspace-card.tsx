"use client";

import {
  ArrowCounterClockwiseIcon,
  CaretDownIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { BookmarkRow } from "~/components/trash/bookmark-row";
import { Button } from "~/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { formatRelativeTime } from "~/lib/format";
import type { TrashedWorkspace } from "~/lib/schemas/workspace.schema";

export function WorkspaceCard({
  workspace,
  selectedBmIds,
  onSelectBookmark,
  onRestore,
  onPermanentDelete,
  onRestoreBookmark,
  onPermanentDeleteBookmark,
}: {
  workspace: TrashedWorkspace;
  selectedBmIds: Set<string>;
  onSelectBookmark: (id: string) => void;
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  onRestoreBookmark: (id: string) => void;
  onPermanentDeleteBookmark: (id: string) => void;
}) {
  return (
    <Collapsible className="border border-border rounded-lg overflow-hidden bg-card transition-shadow hover:shadow-sm">
      <CollapsibleTrigger className="group/trigger flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30">
        <div className="flex items-center gap-3 min-w-0">
          <CaretDownIcon className="size-3.5 text-muted-foreground shrink-0 transition-transform duration-200 -rotate-90 group-data-[panel-open]/trigger:rotate-0" />
          <div className="flex items-center gap-2 min-w-0">
            <div className="size-2 rounded-full bg-muted-foreground/30 shrink-0" />
            <p className="text-sm font-medium truncate">{workspace.name}</p>
            {workspace.bookmarks.length > 0 && (
              <span className="shrink-0 inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
                {workspace.bookmarks.length}
              </span>
            )}
          </div>
        </div>
        <span className="flex items-center gap-1 shrink-0">
          <span className="text-xs text-muted-foreground mr-1 hidden sm:inline">
            trashed{" "}
            {workspace.deleted_at
              ? formatRelativeTime(workspace.deleted_at)
              : "recently"}
          </span>
          <Button
            variant="outline"
            size="xs"
            onClick={(e) => {
              e.stopPropagation();
              onRestore(workspace.id);
            }}
          >
            <ArrowCounterClockwiseIcon className="size-3 sm:mr-1" />
            <span className="hidden sm:inline">Restore</span>
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={(e) => {
              e.stopPropagation();
              onPermanentDelete(workspace.id);
            }}
            className="text-destructive hover:text-destructive"
            title="Delete forever"
          >
            <TrashIcon className="size-3" />
          </Button>
        </span>
      </CollapsibleTrigger>
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
                compact
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
