"use client";

import { ArchiveIcon } from "@phosphor-icons/react";

export function SectionHeader({
  title,
  count,
}: {
  title: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </h2>
      <span className="inline-flex items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
        {count}
      </span>
    </div>
  );
}

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 animate-in fade-in duration-500">
      <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <ArchiveIcon className="size-7 text-muted-foreground/60" />
      </div>
      <p className="text-sm text-muted-foreground">Trash is empty</p>
      <p className="text-xs text-muted-foreground/60 mt-1">
        Deleted items will appear here
      </p>
    </div>
  );
}

export function LoadingSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-4 animate-in fade-in duration-300">
      <div className="h-5 w-24 bg-muted rounded animate-pulse" />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-12 bg-muted rounded-lg animate-pulse"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
