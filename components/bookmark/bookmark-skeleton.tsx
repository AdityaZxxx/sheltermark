import { useMemo } from "react";
import { Skeleton } from "~/components/ui/skeleton";

export function BookmarkListItemSkeleton() {
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

export function BookmarkCardItemSkeleton() {
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

interface BookmarkListSkeletonProps {
  count?: number;
  view?: "list" | "card";
}

export function BookmarkSkeleton({
  count = 5,
  view = "list",
}: BookmarkListSkeletonProps) {
  const SkeletonComponent =
    view === "card" ? BookmarkCardItemSkeleton : BookmarkListItemSkeleton;

  const keys = useMemo(
    () => Array.from({ length: count }, () => crypto.randomUUID()),
    [count],
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
