"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { BookmarkEditInput } from "~/lib/schemas/bookmark.schema";
import type { BookmarkViewVariant } from "~/lib/schemas/common";
import type { Tag } from "~/lib/schemas/tag.schema";
import type { WorkspaceWithCount } from "~/lib/schemas/workspace.schema";

import { useBookmarkMutations, useBookmarks } from "~/hooks/use-bookmarks";
import { useViewPreference } from "~/hooks/use-view-preference";
import { useWorkspaces } from "~/hooks/use-workspaces";
import { useRestoreBookmarks } from "~/lib/mutations/trash.mutations";

interface ActiveBookmark {
  id: string;
  title: string;
  note: string | null;
  tags: Tag[];
}

export interface BookmarkListManager {
  view: BookmarkViewVariant;
  setView: (v: BookmarkViewVariant) => void;
  bookmarks: ReturnType<typeof useBookmarks>["bookmarks"];
  isLoading: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  sort: ReturnType<typeof useBookmarks>["sort"];
  setSort: ReturnType<typeof useBookmarks>["setSort"];
  selectedTagIds: string[];
  setSelectedTagIds: (ids: string[]) => void;
  allTags: Tag[];
  tagsByBookmarkId: Map<string, string[]>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  workspaces: WorkspaceWithCount[];
  currentWorkspace: WorkspaceWithCount | null | undefined;
  onKeyDown: (e: React.KeyboardEvent) => void;
  focusedIndex: number;
  selection: {
    selectedIds: string[];
    isSelectionMode: boolean;
    toggleSelectionMode: () => void;
    toggleSelect: (id: string) => void;
    selectAll: (ids: string[]) => void;
    clearSelection: () => void;
    clearSelectionOnly: () => void;
  };
  isAllSelected: boolean;
  dialogs: {
    editDialogOpen: boolean;
    setEditDialogOpen: (open: boolean) => void;
    activeBookmark: ActiveBookmark | null;
    resetEdit: () => void;
    handleEditTrigger: (id: string) => void;
    handleDeleteTrigger: (id: string) => void;
    handleBulkDeleteTrigger: () => void;
    handleMoveTrigger: (id: string) => void;
    handleBulkMoveTrigger: () => void;
    moveDialogOpen: boolean;
    setMoveDialogOpen: (open: boolean) => void;
    bookmarksToMove: string[];
    resetMove: () => void;
  };
  manageTagsDialogOpen: boolean;
  setManageTagsDialogOpen: (open: boolean) => void;
  handleSubmit: (val: string) => void;
  handleCopyUrl: (url: string) => void;
  handleBulkCopyUrls: () => void;
  handleRefetchTrigger: (id: string) => void;
  handleMoveToWorkspace: (id: string, targetWorkspaceId: string) => void;
  updateBookmarkFields: (input: BookmarkEditInput) => void;
  isUpdatingBookmarkFields: boolean;
  refetchingId: string | null;
  invalidate: () => void;
  toolbarPendingAction: "deleting" | "moving" | null;
}

export function useBookmarkListManager(
  scope: { type: "workspace"; id: string } | { type: "global" },
): BookmarkListManager {
  // ── Infrastructure ───────────────────────────────────────────
  const { view, setView } = useViewPreference();
  const { workspaces, currentWorkspace } = useWorkspaces();
  const {
    bookmarks,
    isLoading,
    searchQuery,
    setSearchQuery,
    sort,
    setSort,
    invalidate,
    allTags,
    tagsByBookmarkId,
    selectedTagIds,
    setSelectedTagIds,
  } = useBookmarks(scope.type === "workspace" ? scope.id : undefined);
  const mutations = useBookmarkMutations();
  const { mutate: restoreBookmarks } = useRestoreBookmarks();

  const { updateBookmarkFields, isUpdatingBookmarkFields, refetchingId } =
    mutations;

  // ── Selection ────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode((prev) => {
      if (prev) setSelectedIds([]);
      return !prev;
    });
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  }, []);

  const selectAll = useCallback((ids: string[]) => setSelectedIds(ids), []);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
    setIsSelectionMode(false);
  }, []);

  const clearSelectionOnly = useCallback(() => setSelectedIds([]), []);

  // ── Dialog state ─────────────────────────────────────────────
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [activeBookmark, setActiveBookmark] = useState<ActiveBookmark | null>(
    null,
  );
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [bookmarksToMove, setBookmarksToMove] = useState<string[]>([]);
  const [manageTagsDialogOpen, setManageTagsDialogOpen] = useState(false);

  // ── Inline delete (replaces BookmarkTrash) ───────────────────
  const executeDelete = useCallback(
    (ids: string[]) => {
      mutations.deleteBookmarks({ ids });
      invalidate();
      if (ids.length > 0) clearSelection();
      const toastId = toast("Moved to trash", {
        action: {
          label: "Undo",
          onClick: () => {
            toast.dismiss(toastId);
            restoreBookmarks({ ids });
          },
        },
      });
    },
    [mutations, restoreBookmarks, invalidate, clearSelection],
  );

  const handleDeleteTrigger = useCallback(
    (id: string) => executeDelete([id]),
    [executeDelete],
  );

  const handleBulkDeleteTrigger = useCallback(
    () => executeDelete(selectedIds),
    [executeDelete, selectedIds],
  );

  // ── Edit dialog ──────────────────────────────────────────────
  const resetEdit = useCallback(() => {
    setActiveBookmark(null);
    setEditDialogOpen(false);
  }, []);

  const handleEditTrigger = useCallback(
    (id: string) => {
      const bookmark = bookmarks.find((b) => b.id === id);
      if (!bookmark) return;
      const tagIds = tagsByBookmarkId.get(id) ?? [];
      const tags = tagIds
        .map((tagId) => allTags.find((t) => t.id === tagId))
        .filter((t): t is Tag => t !== undefined);
      setActiveBookmark({
        id: bookmark.id,
        title: bookmark.title || "",
        note: bookmark.note ?? null,
        tags,
      });
      setEditDialogOpen(true);
    },
    [bookmarks, tagsByBookmarkId, allTags],
  );

  // ── Move dialog ──────────────────────────────────────────────
  const handleMoveTrigger = useCallback((id: string) => {
    setBookmarksToMove([id]);
    setMoveDialogOpen(true);
  }, []);

  const handleBulkMoveTrigger = useCallback(() => {
    setBookmarksToMove(selectedIds);
    setMoveDialogOpen(true);
  }, [selectedIds]);

  const resetMove = useCallback(() => {
    setBookmarksToMove([]);
    setMoveDialogOpen(false);
  }, []);

  // ── Keyboard navigation ─────────────────────────────────────
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const getItem = useCallback(
    (index: number) => {
      const bookmark = bookmarks[index];
      if (bookmark) {
        return { id: bookmark.id, url: bookmark.url };
      }
      return undefined;
    },
    [bookmarks],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (
        document.activeElement === inputRef.current ||
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (bookmarks.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((prev) =>
          prev < bookmarks.length - 1 ? prev + 1 : prev,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (view === "card") {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          setFocusedIndex((prev) =>
            prev < bookmarks.length - 1 ? prev + 1 : prev,
          );
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        }
      }

      if (e.key === "Enter" && focusedIndex >= 0) {
        const item = getItem(focusedIndex);
        if (item) {
          if (isSelectionMode) {
            toggleSelect(item.id);
          } else {
            window.open(item.url, "_blank");
          }
        }
      }
    },
    [bookmarks, view, focusedIndex, isSelectionMode, toggleSelect, getItem],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      handleKeyDown(e);
    },
    [handleKeyDown],
  );

  // ── Global shortcuts (window-level, replaces useBookmarkGlobalShortcuts) ──
  const editDialogOpenRef = useRef(editDialogOpen);
  const moveDialogOpenRef = useRef(moveDialogOpen);
  const isSelectionModeRef = useRef(isSelectionMode);
  const focusedIndexRef = useRef(focusedIndex);
  const selectedIdsRef = useRef(selectedIds);

  editDialogOpenRef.current = editDialogOpen;
  moveDialogOpenRef.current = moveDialogOpen;
  isSelectionModeRef.current = isSelectionMode;
  focusedIndexRef.current = focusedIndex;
  selectedIdsRef.current = selectedIds;

  // ── Global shortcuts (window-level) ──────────────────────────
  // Read changing values through refs; effect runs once on mount.
  const bookmarksRef = useRef(bookmarks);
  bookmarksRef.current = bookmarks;
  const selectAllRef = useRef(selectAll);
  selectAllRef.current = selectAll;
  const toggleSelectRef = useRef(toggleSelect);
  toggleSelectRef.current = toggleSelect;
  const clearSelectionRef = useRef(clearSelection);
  clearSelectionRef.current = clearSelection;
  const handleEditTriggerRef = useRef(handleEditTrigger);
  handleEditTriggerRef.current = handleEditTrigger;
  const handleDeleteTriggerRef = useRef(handleDeleteTrigger);
  handleDeleteTriggerRef.current = handleDeleteTrigger;

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (editDialogOpenRef.current || moveDialogOpenRef.current) return;

      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement === inputRef.current ||
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA";

      if (isInputFocused) {
        if ((e.metaKey || e.ctrlKey) && e.key === "k") {
          e.preventDefault();
          inputRef.current?.focus();
          return;
        }
        if (e.metaKey || e.ctrlKey) return;
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }

      const items = bookmarksRef.current;
      if (items.length === 0) return;
      const activeIdx = focusedIndexRef.current;

      if (isSelectionModeRef.current) {
        if ((e.metaKey || e.ctrlKey) && e.key === "a") {
          e.preventDefault();
          selectAllRef.current(items.map((b) => b.id));
          return;
        }
        if (e.key === " " && activeIdx >= 0) {
          e.preventDefault();
          const item = items[activeIdx];
          if (item) toggleSelectRef.current(item.id);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          clearSelectionRef.current();
          return;
        }
      }

      if (activeIdx >= 0) {
        const item = items[activeIdx];
        if (!item) return;

        if ((e.metaKey || e.ctrlKey) && e.key === "c") {
          e.preventDefault();
          navigator.clipboard.writeText(item.url);
          toast.success("URL copied to clipboard");
          return;
        }

        if ((e.metaKey || e.ctrlKey) && e.key === "e") {
          e.preventDefault();
          handleEditTriggerRef.current(item.id);
          return;
        }

        if ((e.metaKey || e.ctrlKey) && e.key === "Backspace") {
          e.preventDefault();
          handleDeleteTriggerRef.current(item.id);
          return;
        }
      }
    };

    const handleSelectionEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSelectionModeRef.current) {
        clearSelectionRef.current();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    window.addEventListener("keydown", handleSelectionEscape);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
      window.removeEventListener("keydown", handleSelectionEscape);
    };
  }, []);

  // ── Actions ──────────────────────────────────────────────────
  const handleCopyUrl = useCallback((url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("URL copied to clipboard");
  }, []);

  const handleBulkCopyUrls = useCallback(() => {
    const urls = bookmarks
      .filter((b) => selectedIds.includes(b.id))
      .map((b) => b.url)
      .join("\n");
    navigator.clipboard.writeText(urls);
    toast.success(`${selectedIds.length} URLs copied`);
  }, [bookmarks, selectedIds]);

  const handleRefetchTrigger = useCallback(
    (id: string) => {
      mutations.refetchBookmarkMetadata({ id });
    },
    [mutations],
  );

  const handleMoveToWorkspace = useCallback(
    (id: string, targetWorkspaceId: string) => {
      mutations.moveBookmarks(
        { ids: [id], targetWorkspaceId },
        {
          onSuccess: (res) => {
            if (res.success && res.data) {
              const workspace = workspaces.find(
                (ws) => ws.id === targetWorkspaceId,
              );
              const workspaceName = workspace?.name || "Target Workspace";
              const { movedCount, skippedCount } = res.data;
              if (movedCount > 0 && skippedCount > 0) {
                toast.success(
                  `${movedCount} moved, ${skippedCount} already in ${workspaceName}`,
                );
              } else if (movedCount > 0) {
                toast.success(`Bookmark moved to ${workspaceName}`);
              } else if (skippedCount > 0) {
                toast.info(`Bookmark already exists in ${workspaceName}`);
              }
            }
          },
        },
      );
    },
    [mutations, workspaces],
  );

  const handleSubmit = useCallback(
    (val: string) => {
      const trimmed = val.trim();
      const targetWorkspace =
        currentWorkspace ??
        workspaces.find((ws) => ws.is_default) ??
        workspaces[0];
      if (!targetWorkspace) {
        toast.error("Please create a workspace first");
        return;
      }
      if (trimmed.includes(".") || trimmed.startsWith("http")) {
        const normalizedUrl = trimmed.startsWith("http")
          ? trimmed
          : `https://${trimmed}`;
        setSearchQuery("");
        mutations.addBookmark(
          { url: normalizedUrl, workspaceId: targetWorkspace.id },
          {
            onSuccess: () => invalidate(),
            onError: (err) =>
              toast.error(err.message || "Failed to add bookmark"),
          },
        );
      }
    },
    [currentWorkspace, workspaces, mutations, invalidate, setSearchQuery],
  );

  // ── Composed values ──────────────────────────────────────────
  const isAllSelected =
    selectedIds.length === bookmarks.length && bookmarks.length > 0;

  const toolbarPendingAction = isUpdatingBookmarkFields
    ? null
    : mutations.isDeletingBookmarks
      ? ("deleting" as const)
      : mutations.isMovingBookmarks
        ? ("moving" as const)
        : null;

  return {
    view,
    setView,
    bookmarks,
    isLoading,
    searchQuery,
    setSearchQuery,
    sort,
    setSort,
    selectedTagIds,
    setSelectedTagIds,
    allTags,
    tagsByBookmarkId,
    inputRef,
    workspaces,
    currentWorkspace,
    onKeyDown,
    focusedIndex,
    selection: {
      selectedIds,
      isSelectionMode,
      toggleSelectionMode,
      toggleSelect,
      selectAll,
      clearSelection,
      clearSelectionOnly,
    },
    isAllSelected,
    dialogs: {
      editDialogOpen,
      setEditDialogOpen,
      activeBookmark,
      resetEdit,
      handleEditTrigger,
      handleDeleteTrigger,
      handleBulkDeleteTrigger,
      handleMoveTrigger,
      handleBulkMoveTrigger,
      moveDialogOpen,
      setMoveDialogOpen,
      bookmarksToMove,
      resetMove,
    },
    manageTagsDialogOpen,
    setManageTagsDialogOpen,
    handleSubmit,
    handleCopyUrl,
    handleBulkCopyUrls,
    handleRefetchTrigger,
    handleMoveToWorkspace,
    updateBookmarkFields,
    isUpdatingBookmarkFields,
    refetchingId,
    invalidate,
    toolbarPendingAction,
  };
}
