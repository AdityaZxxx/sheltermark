"use client";

import { ArchiveIcon, TrashIcon } from "@phosphor-icons/react";
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
import { WorkspaceRestoreDialog } from "~/components/trash/workspace-restore-dialog";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useProfile } from "~/hooks/use-profile";
import { useTrash } from "~/hooks/use-trash";
import { useWorkspaces } from "~/hooks/use-workspaces";
import {
  useEmptyTrash,
  usePermanentDeleteBookmarks,
  usePermanentDeleteWorkspace,
  useRestoreBookmarks,
  useRestoreWorkspace,
} from "~/lib/mutations/trash.mutations";

export function TrashView() {
  const { trashedBookmarks, trashedWorkspaces, isLoading, totalCount } =
    useTrash();
  const { profile } = useProfile();
  const { workspaces: activeWorkspaces } = useWorkspaces();
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
    trashedWorkspaceName: string | null;
    trashedWorkspaceId: string | null;
    originalWorkspaceName: string | null;
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [pendingRestoreWs, setPendingRestoreWs] = useState<{
    id: string;
    name: string;
    bookmarkCount: number;
  } | null>(null);

  const trashedBookmarkIdsFromWs = new Set(
    trashedWorkspaces.flatMap((ws) => ws.bookmarks.map((bm) => bm.id)),
  );

  // Map bookmark id → its trashed parent workspace
  const trashedBookmarkToWs = new Map<string, { id: string; name: string }>();
  for (const ws of trashedWorkspaces) {
    for (const bm of ws.bookmarks) {
      trashedBookmarkToWs.set(bm.id, { id: ws.id, name: ws.name });
    }
  }

  const openRestoreDialog = (ids: string[]) => {
    const hasTrashedOrigin = ids.some((id) => trashedBookmarkIdsFromWs.has(id));

    let trashedWorkspaceName: string | null = null;
    let trashedWorkspaceId: string | null = null;

    if (hasTrashedOrigin) {
      for (const id of ids) {
        const ws = trashedBookmarkToWs.get(id);
        if (ws) {
          trashedWorkspaceName = ws.name;
          trashedWorkspaceId = ws.id;
          break;
        }
      }
    }

    let originalWorkspaceName: string | null = null;
    if (!hasTrashedOrigin && ids.length > 0) {
      const bm = trashedBookmarks.find((b) => b.id === ids[0]);
      if (bm?.workspace_id) {
        const ws = activeWorkspaces.find((w) => w.id === bm.workspace_id);
        if (ws) originalWorkspaceName = ws.name;
      }
    }

    setRestoreTarget({
      ids,
      hasTrashedOrigin,
      trashedWorkspaceName,
      trashedWorkspaceId,
      originalWorkspaceName,
    });
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

  const handleRestoreWorkspaceFirst = () => {
    if (!restoreTarget?.trashedWorkspaceId) return;
    const wsId = restoreTarget.trashedWorkspaceId;
    const ws = trashedWorkspaces.find((w) => w.id === wsId);
    if (!ws) return;
    setPendingRestoreWs({
      id: ws.id,
      name: ws.name,
      bookmarkCount: ws.bookmarks.length,
    });
  };

  const handleWorkspaceRestoreConfirm = () => {
    if (!pendingRestoreWs) return;
    restoreWs.mutate(pendingRestoreWs.id);
    setPendingRestoreWs(null);
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

  const pendingRestoreWsHasDuplicate = pendingRestoreWs
    ? activeWorkspaces.some(
        (ws) => ws.name.toLowerCase() === pendingRestoreWs.name.toLowerCase(),
      )
    : false;

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold flex items-center-safe gap-2">
              <ArchiveIcon className="size-5" />
              Trash
            </h1>
            {totalCount > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {totalCount} item{totalCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {totalCount > 0 && profile && (
            <div className="flex items-center gap-3 justify-between sm:justify-end w-full sm:w-auto">
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                Auto-delete {profile.trash_cleanup_interval}d
              </span>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setEmptyTrashOpen(true)}
              >
                <TrashIcon className="size-3.5 mr-1" />
                <span className="hidden sm:inline">Empty trash</span>
                <span className="sm:hidden">Empty</span>
              </Button>
            </div>
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
                      onRestore={(id) =>
                        setPendingRestoreWs({
                          id,
                          name: ws.name,
                          bookmarkCount: ws.bookmarks.length,
                        })
                      }
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
            // Bulk bar only tracks standalone bookmarks;
            // bookmarks inside trashed workspaces are not individually selectable via bulk
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
        trashedWorkspaceName={restoreTarget?.trashedWorkspaceName ?? null}
        originalWorkspaceName={restoreTarget?.originalWorkspaceName ?? null}
        onRestoreWorkspace={
          restoreTarget?.trashedWorkspaceId
            ? handleRestoreWorkspaceFirst
            : undefined
        }
        isRestoringWorkspace={restoreWs.isPending}
        onConfirm={handleRestoreConfirm}
      />

      <DeleteConfirmDialog
        pendingDelete={pendingDelete}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
      />

      <WorkspaceRestoreDialog
        open={pendingRestoreWs !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRestoreWs(null);
        }}
        workspaceName={pendingRestoreWs?.name ?? ""}
        bookmarkCount={pendingRestoreWs?.bookmarkCount ?? 0}
        hasDuplicateName={pendingRestoreWsHasDuplicate}
        onConfirm={handleWorkspaceRestoreConfirm}
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
