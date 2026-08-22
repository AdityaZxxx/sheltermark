import type { BookmarkViewVariant } from "~/lib/schemas/common";

import { Skeleton } from "~/components/ui/skeleton";

function BookmarkListItemSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
      <Skeleton className="shrink-0 w-6 h-6 rounded-xs" />
      <div className="flex-1 flex items-center justify-between min-w-0 gap-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-20 shrink-0" />
      </div>
      <Skeleton className="h-3 w-16 shrink-0" />
    </div>
  );
}

function BookmarkCardItemSkeleton() {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Skeleton className="w-full h-32" />
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="w-5 h-5 rounded-xs shrink-0" />
          <Skeleton className="h-4 flex-1" />
        </div>
      </div>
    </div>
  );
}

function BookmarkComfortItemSkeleton() {
  return (
    <div className="flex gap-4 rounded-lg border p-3">
      <div className="flex-1 space-y-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex items-center gap-2 mt-2">
          <Skeleton className="w-4 h-4 rounded-xs shrink-0" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="w-24 sm:w-36 shrink-0 rounded-md aspect-video" />
    </div>
  );
}

interface BookmarkListSkeletonProps {
  count?: number;
  view?: BookmarkViewVariant;
}

export function BookmarkSkeleton({
  count = 5,
  view = "list",
}: BookmarkListSkeletonProps) {
  const SkeletonComponent =
    view === "card"
      ? BookmarkCardItemSkeleton
      : view === "comfort"
        ? BookmarkComfortItemSkeleton
        : BookmarkListItemSkeleton;

  const keys = Array.from(
    { length: count },
    (_, i) => `bookmark-skeleton-${i}`,
  );

  return (
    <div
      className={
        view === "card"
          ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          : "flex flex-col gap-1"
      }
    >
      {keys.map((key) => (
        <SkeletonComponent key={key} />
      ))}
    </div>
  );
}
