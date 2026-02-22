"use client";

import { useQueryState } from "nuqs";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { getPastelColor, safeDomain, slugify } from "~/lib/utils";
import type { WorkspaceWithBookmarks } from "~/types/workspace.types";
import { BookmarkCardItem } from "./bookmark-card-item";
import { BookmarkListItem } from "./bookmark-list-item";
import { BookmarkSkeleton } from "./bookmark-skeleton";
import { BookmarkViewToggle } from "./bookmark-view-toggle";

interface BookmarkViewReadOnlyProps {
  workspaces: WorkspaceWithBookmarks[];
  isLoading?: boolean;
}

export function BookmarkViewReadOnly({
  workspaces,
  isLoading = false,
}: BookmarkViewReadOnlyProps) {
  const [view, setView] = useState<"list" | "card">("list");
  const [activeWorkspace, setActiveWorkspace] = useQueryState("workspace");

  const publicWorkspaces = workspaces.filter((ws) => ws.bookmarks.length > 0);

  const activeWorkspaceData = publicWorkspaces.find(
    (ws) => slugify(ws.name) === activeWorkspace,
  );

  const tabs: { value: string; label: string; color?: string }[] = [
    { value: "all", label: "All" },
    ...publicWorkspaces.map((ws) => ({
      value: slugify(ws.name),
      label: ws.name,
      color: getPastelColor(ws.id),
    })),
  ];

  const filteredBookmarks =
    activeWorkspace && activeWorkspace !== "all"
      ? activeWorkspaceData?.bookmarks || []
      : publicWorkspaces.flatMap((ws) => ws.bookmarks);

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="w-full">
            <div className="h-9 w-64 bg-muted animate-pulse rounded-lg" />
          </div>
          <div className="h-9 w-20 bg-muted animate-pulse rounded-lg" />
        </div>
      ) : publicWorkspaces.length > 0 ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="w-full overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 overflow-y-hidden">
            <Tabs
              value={activeWorkspace || "all"}
              onValueChange={(v) => setActiveWorkspace(v === "all" ? null : v)}
            >
              <TabsList className="bg-muted/60 h-9 w-max">
                {tabs.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="px-3 text-sm shrink-0 gap-2"
                  >
                    {tab.color && (
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${tab.color}`}
                      />
                    )}
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <BookmarkViewToggle view={view} onViewChange={setView} />
        </div>
      ) : null}

      {isLoading ? (
        <BookmarkSkeleton count={6} view={view} />
      ) : filteredBookmarks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No public bookmarks yet.</p>
        </div>
      ) : view === "card" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBookmarks.map((bookmark, index) => (
            <BookmarkCardItem
              key={bookmark.id}
              id={bookmark.id}
              title={bookmark.title || ""}
              url={bookmark.url}
              og_image_url={bookmark.og_image_url || undefined}
              favicon_url={bookmark.favicon_url || undefined}
              domain={safeDomain(bookmark.url)}
              created_at={bookmark.created_at}
              isSelected={false}
              isSelectionMode={false}
              tabIndex={index === 0 ? 0 : -1}
              disableContextMenu={true}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredBookmarks.map((bookmark, index) => (
            <BookmarkListItem
              key={bookmark.id}
              id={bookmark.id}
              title={bookmark.title || ""}
              url={bookmark.url}
              favicon_url={bookmark.favicon_url || undefined}
              domain={safeDomain(bookmark.url)}
              created_at={bookmark.created_at}
              isSelected={false}
              isSelectionMode={false}
              tabIndex={index === 0 ? 0 : -1}
              disableContextMenu={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}
