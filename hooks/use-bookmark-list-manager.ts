"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { BookmarkEditInput } from "~/lib/schemas/bookmark.schema";
import type { BookmarkViewVariant } from "~/lib/schemas/common";
import type { Tag } from "~/lib/schemas/tag.schema";
import type { WorkspaceWithCount } from "~/lib/schemas/workspace.schema";

import { interpretSearchQuery } from "~/app/action/bookmark.action";
import { useBookmarkMutations } from "~/hooks/use-bookmark-mutations";
import { useBookmarks } from "~/hooks/use-bookmarks";
import { useViewPreference } from "~/hooks/use-view-preference";
import { useWorkspaces } from "~/hooks/use-workspaces";
import { useRestoreBookmarks } from "~/lib/mutations/trash.mutations";
import { isUrlLike } from "~/lib/utils";

function copyUrlToClipboard(url: string) {
  navigator.clipboard.writeText(url);
  toast.success("URL copied to clipboard");
}

interface ActiveBookmark {
  id: string;
  title: string;
  note: string | null;
  tags: Tag[];
}

interface BookmarkListManager {
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
  filterKey: string;
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
  handleAskAi: () => Promise<void>;
  isAiSearching: boolean;
  aiSearchTerms: string[] | null;
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
    filterKey,
    aiSearchTerms,
    setAiSearchTerms,
    userId,
  } = useBookmarks(scope.type === "workspace" ? scope.id : undefined);
  const mutations = useBookmarkMutations();
  const { mutate: restoreBookmarks } = useRestoreBookmarks(userId);

  const { updateBookmarkFields, isUpdatingBookmarkFields, refetchingId } =
    mutations;

  // ── Selection ────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const toggleSelectionMode = () => {
    if (isSelectionMode) {
      setSelectedIds([]);
    }
    setIsSelectionMode(!isSelectionMode);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const selectAll = (ids: string[]) => setSelectedIds(ids);

  const clearSelection = () => {
    setSelectedIds([]);
    setIsSelectionMode(false);
  };

  const clearSelectionOnly = () => setSelectedIds([]);

  // ── Dialog state ─────────────────────────────────────────────
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [activeBookmark, setActiveBookmark] = useState<ActiveBookmark | null>(
    null,
  );
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [bookmarksToMove, setBookmarksToMove] = useState<string[]>([]);
  const [manageTagsDialogOpen, setManageTagsDialogOpen] = useState(false);

  // ── Inline delete ────────────────────────────────────────────
  const executeDelete = (ids: string[]) => {
    mutations.deleteBookmarks({ ids });
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
  };

  const handleDeleteTrigger = (id: string) => executeDelete([id]);

  const handleBulkDeleteTrigger = () => executeDelete(selectedIds);

  // ── Edit dialog ──────────────────────────────────────────────
  const resetEdit = () => {
    setActiveBookmark(null);
    setEditDialogOpen(false);
  };

  const handleEditTrigger = (id: string) => {
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
  };

  // ── Move dialog ──────────────────────────────────────────────
  const handleMoveTrigger = (id: string) => {
    setBookmarksToMove([id]);
    setMoveDialogOpen(true);
  };

  const handleBulkMoveTrigger = () => {
    setBookmarksToMove(selectedIds);
    setMoveDialogOpen(true);
  };

  const resetMove = () => {
    setBookmarksToMove([]);
    setMoveDialogOpen(false);
  };

  // ── Keyboard navigation ─────────────────────────────────────
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const getItem = (index: number) => {
    const bookmark = bookmarks[index];
    if (bookmark) {
      return { id: bookmark.id, url: bookmark.url };
    }
    return undefined;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
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
          window.open(item.url, "_blank", "noopener,noreferrer");
        }
      }
    }
  };

  // ── Global shortcuts (window-level) ──────────────────────────
  const editDialogOpenRef = useRef(editDialogOpen);
  const moveDialogOpenRef = useRef(moveDialogOpen);
  const isSelectionModeRef = useRef(isSelectionMode);
  const focusedIndexRef = useRef(focusedIndex);
  const bookmarksRef = useRef(bookmarks);
  const selectAllRef = useRef(selectAll);
  const toggleSelectRef = useRef(toggleSelect);
  const clearSelectionRef = useRef(clearSelection);
  const handleEditTriggerRef = useRef(handleEditTrigger);
  const handleDeleteTriggerRef = useRef(handleDeleteTrigger);

  // Latest-ref pattern: the keydown effect below mounts once and reads
  // changing values through these refs at event time.
  useEffect(() => {
    editDialogOpenRef.current = editDialogOpen;
    moveDialogOpenRef.current = moveDialogOpen;
    isSelectionModeRef.current = isSelectionMode;
    focusedIndexRef.current = focusedIndex;
    bookmarksRef.current = bookmarks;
    selectAllRef.current = selectAll;
    toggleSelectRef.current = toggleSelect;
    clearSelectionRef.current = clearSelection;
    handleEditTriggerRef.current = handleEditTrigger;
    handleDeleteTriggerRef.current = handleDeleteTrigger;
  });

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
        }
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

  // ── AI-assisted search ──────────────────────────────────────
  const [isAiSearching, setIsAiSearching] = useState(false);

  const handleAskAi = async () => {
    const query = searchQuery.trim();
    if (!query || isUrlLike(query) || isAiSearching) return;
    setIsAiSearching(true);
    const result = await interpretSearchQuery({ query });
    setIsAiSearching(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    if (result.data.terms.length === 0) {
      toast.info("AI found no search terms — showing regular results");
      return;
    }
    setAiSearchTerms(result.data.terms);
  };

  // ── Actions ──────────────────────────────────────────────────
  const handleBulkCopyUrls = () => {
    const urls = bookmarks
      .filter((b) => selectedIds.includes(b.id))
      .map((b) => b.url)
      .join("\n");
    navigator.clipboard.writeText(urls);
    toast.success(`${selectedIds.length} URLs copied`);
  };

  const handleRefetchTrigger = (id: string) => {
    mutations.refetchBookmarkMetadata({ id });
  };

  const handleMoveToWorkspace = (id: string, targetWorkspaceId: string) => {
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
  };

  const handleSubmit = (val: string) => {
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
          onError: () => toast.error("Failed to add bookmark"),
        },
      );
    }
  };

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
    filterKey,
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
    handleAskAi,
    isAiSearching,
    aiSearchTerms,
    handleCopyUrl: copyUrlToClipboard,
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
