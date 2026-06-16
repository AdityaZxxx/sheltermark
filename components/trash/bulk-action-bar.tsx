"use client";

import { ArrowCounterClockwiseIcon, TrashIcon } from "@phosphor-icons/react";
import { Button } from "~/components/ui/button";

export function BulkActionBar({
  count,
  onRestore,
  onPermanentDelete,
}: {
  count: number;
  onRestore: () => void;
  onPermanentDelete: () => void;
}) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="flex items-center gap-2 rounded-full border border-border bg-background/90 px-4 py-2 shadow-lg backdrop-blur-md">
        <span className="text-xs text-muted-foreground mr-1 tabular-nums">
          {count} selected
        </span>
        <div className="h-4 w-px bg-border" />
        <Button variant="secondary" size="xs" onClick={onRestore}>
          <ArrowCounterClockwiseIcon className="size-3 mr-1" />
          Restore
        </Button>
        <Button variant="destructive" size="xs" onClick={onPermanentDelete}>
          <TrashIcon className="size-3 mr-1" />
          Delete forever
        </Button>
      </div>
    </div>
  );
}
