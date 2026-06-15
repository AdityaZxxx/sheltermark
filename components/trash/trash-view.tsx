"use client";

import { ArchiveIcon, ArrowLeftIcon, TrashIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookmarkRow } from "~/components/trash/bookmark-row";
import { BulkActionBar } from "~/components/trash/bulk-action-bar";
import {
  DeleteConfirmDialog,
  type PendingDelete,
} from "~/components/trash/delete-confirm-dialog";
import { RestoreDialog } from "~/components/trash/restore-dialog";
import {
  EmptyState,
  LoadingSkeleton,
  SectionHeader,
} from "~/components/trash/trash-shell";
import { WorkspaceCard } from "~/components/trash/workspace-card";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useTrash } from "~/hooks/use-trash";
import {
  useEmptyTrash,
  usePermanentDeleteBookmarks,
  usePermanentDeleteWorkspace,
  useRestoreBookmarks,
  useRestoreWorkspace,
} from "~/lib/mutations/trash.mutations";

export function TrashView() {
  const router = useRouter();
  const { trashedBookmarks, trashedWorkspaces, isLoading, totalCount } =
    useTrash();
  const restoreBm = useRestoreBookmarks();
  const restoreWs = useRestoreWorkspace();
  const permanentDeleteBm = usePermanentDeleteBookmarks();
  const permanentDeleteWs = usePermanentDeleteWorkspace();
  const emptyTrashMut = useEmptyTrash();

  const [selectedBmIds, setSelectedBmIds] = useState<Set<string>>(new Set());
  const [emptyTrashOpen, setEmptyTrashOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<{
    ids: string[];
    hasTrashedOrigin: boolean;
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);

  const trashedBookmarkIdsFromWs = new Set(
    trashedWorkspaces.flatMap((ws) => ws.bookmarks.map((bm) => bm.id)),
  );

  const openRestoreDialog = (ids: string[]) => {
    const hasTrashedOrigin = ids.some((id) => trashedBookmarkIdsFromWs.has(id));
    setRestoreTarget({ ids, hasTrashedOrigin });
  };

  const handleRestoreConfirm = (options: {
    targetWorkspaceId?: string | null;
    newWorkspaceName?: string;
  }) => {
    if (!restoreTarget) return;
    restoreBm.mutate({ ids: restoreTarget.ids, ...options });
    setRestoreTarget(null);
    clearSelection();
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedBmIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedBmIds(next);
  };

  const clearSelection = () => setSelectedBmIds(new Set());

  const trashedWorkspaceIds = new Set(trashedWorkspaces.map((ws) => ws.id));
  const standaloneBookmarks = trashedBookmarks.filter(
    (bm) => !bm.workspace_id || !trashedWorkspaceIds.has(bm.workspace_id),
  );

  if (isLoading) return <LoadingSkeleton />;

  const handleDeleteConfirm = () => {
    if (!pendingDelete) return;
    if (pendingDelete.kind === "bookmark") {
      permanentDeleteBm.mutate(pendingDelete.ids);
      clearSelection();
    } else {
      permanentDeleteWs.mutate(pendingDelete.id);
    }
    setPendingDelete(null);
  };

  return (
    <>
      <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => router.push("/dashboard")}
            >
              <ArrowLeftIcon className="size-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <ArchiveIcon className="size-5" />
                Trash
              </h1>
              {totalCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {totalCount} item{totalCount !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>
          {totalCount > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setEmptyTrashOpen(true)}
            >
              <TrashIcon className="size-3.5 mr-1" />
              Empty trash
            </Button>
          )}
        </div>

        {totalCount === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-8">
            {trashedWorkspaces.length > 0 && (
              <section className="animate-in fade-in slide-in-from-top-2 duration-300">
                <SectionHeader
                  title="Workspaces"
                  count={trashedWorkspaces.length}
                />
                <div className="space-y-2">
                  {trashedWorkspaces.map((ws) => (
                    <WorkspaceCard
                      key={ws.id}
                      workspace={ws}
                      selectedBmIds={selectedBmIds}
                      onSelectBookmark={toggleSelect}
                      onRestore={(id) => restoreWs.mutate(id)}
                      onPermanentDelete={(id) =>
                        setPendingDelete({
                          kind: "workspace",
                          id,
                          name: ws.name,
                          bookmarkCount: ws.bookmarks.length,
                        })
                      }
                      onRestoreBookmark={(id) => openRestoreDialog([id])}
                      onPermanentDeleteBookmark={(id) =>
                        setPendingDelete({ kind: "bookmark", ids: [id] })
                      }
                    />
                  ))}
                </div>
              </section>
            )}

            {standaloneBookmarks.length > 0 && (
              <section className="animate-in fade-in slide-in-from-top-2 duration-300">
                <SectionHeader
                  title="Bookmarks"
                  count={standaloneBookmarks.length}
                />
                <div className="border border-border rounded-lg overflow-hidden">
                  {standaloneBookmarks.map((bm) => (
                    <BookmarkRow
                      key={bm.id}
                      bookmark={bm}
                      isSelected={selectedBmIds.has(bm.id)}
                      onSelect={toggleSelect}
                      onRestore={(id) => openRestoreDialog([id])}
                      onPermanentDelete={(id) =>
                        setPendingDelete({ kind: "bookmark", ids: [id] })
                      }
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {selectedBmIds.size > 0 && (
        <BulkActionBar
          count={selectedBmIds.size}
          onRestore={() => openRestoreDialog(Array.from(selectedBmIds))}
          onPermanentDelete={() => {
            setPendingDelete({
              kind: "bookmark",
              ids: Array.from(selectedBmIds),
            });
          }}
        />
      )}

      <RestoreDialog
        open={restoreTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRestoreTarget(null);
        }}
        bookmarkCount={restoreTarget?.ids.length ?? 0}
        hasTrashedOrigin={restoreTarget?.hasTrashedOrigin ?? false}
        onConfirm={handleRestoreConfirm}
      />

      <DeleteConfirmDialog
        pendingDelete={pendingDelete}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
      />

      <Dialog open={emptyTrashOpen} onOpenChange={setEmptyTrashOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Empty trash?</DialogTitle>
            <DialogDescription>
              This will permanently delete all items in trash. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmptyTrashOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                emptyTrashMut.mutate(undefined, {
                  onSuccess: () => setEmptyTrashOpen(false),
                });
              }}
            >
              Empty trash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
