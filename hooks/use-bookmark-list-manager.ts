"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type {
  Bookmark,
  BookmarkEditInput,
} from "~/lib/schemas/bookmark.schema";
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

// Row pitch (row height + gap) per view, for keyboard paging and for
// scrolling unmounted virtualized rows into range.
const ROW_PITCH = {
  list: 42,
  comfort: 104,
  card: 240,
} satisfies Record<BookmarkViewVariant, number>;

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
  focusedIndex: number;
  previewBookmark: Bookmark | null;
  openPreview: (id: string) => void;
  closePreview: () => void;
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
  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;
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
  sectionRef: React.RefObject<HTMLElement | null>,
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

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [activeBookmark, setActiveBookmark] = useState<ActiveBookmark | null>(
    null,
  );
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [bookmarksToMove, setBookmarksToMove] = useState<string[]>([]);
  const [manageTagsDialogOpen, setManageTagsDialogOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  const [previewBookmark, setPreviewBookmark] = useState<Bookmark | null>(null);
  const previewTriggerRef = useRef<HTMLElement | null>(null);

  const openPreview = (id: string) => {
    const bookmark = bookmarks.find((b) => b.id === id);
    if (!bookmark) return;
    previewTriggerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setPreviewBookmark(bookmark);
  };

  const closePreview = () => {
    setPreviewBookmark(null);
    const trigger = previewTriggerRef.current;
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    previewTriggerRef.current = null;
  };

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

  const resetEdit = () => {
    setActiveBookmark(null);
    setEditDialogOpen(false);
  };

  const handleEditTrigger = (id: string) => {
    const bookmark = bookmarks.find((b) => b.id === id);
    if (!bookmark) return;
    lastTriggerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
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

  const handleMoveTrigger = (id: string) => {
    lastTriggerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
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

  const [focusedIndex, setFocusedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const editDialogOpenRef = useRef(editDialogOpen);
  const moveDialogOpenRef = useRef(moveDialogOpen);
  const shortcutsOpenRef = useRef(shortcutsOpen);
  const manageTagsDialogOpenRef = useRef(manageTagsDialogOpen);
  const isSelectionModeRef = useRef(isSelectionMode);
  const focusedIndexRef = useRef(focusedIndex);
  const bookmarksRef = useRef(bookmarks);
  const viewRef = useRef(view);
  const selectedIdsRef = useRef(selectedIds);
  const selectAllRef = useRef(selectAll);
  const toggleSelectRef = useRef(toggleSelect);
  const clearSelectionRef = useRef(clearSelection);
  const handleEditTriggerRef = useRef(handleEditTrigger);
  const handleDeleteTriggerRef = useRef(handleDeleteTrigger);
  const handleMoveTriggerRef = useRef(handleMoveTrigger);
  const handleBulkMoveTriggerRef = useRef(handleBulkMoveTrigger);
  const previewBookmarkRef = useRef(previewBookmark);
  const openPreviewRef = useRef(openPreview);
  const closePreviewRef = useRef(closePreview);

  // Latest-ref pattern: the keydown effect below mounts once and reads
  // changing values through these refs at event time.
  useEffect(() => {
    editDialogOpenRef.current = editDialogOpen;
    moveDialogOpenRef.current = moveDialogOpen;
    shortcutsOpenRef.current = shortcutsOpen;
    manageTagsDialogOpenRef.current = manageTagsDialogOpen;
    isSelectionModeRef.current = isSelectionMode;
    focusedIndexRef.current = focusedIndex;
    bookmarksRef.current = bookmarks;
    viewRef.current = view;
    selectedIdsRef.current = selectedIds;
    selectAllRef.current = selectAll;
    toggleSelectRef.current = toggleSelect;
    clearSelectionRef.current = clearSelection;
    handleEditTriggerRef.current = handleEditTrigger;
    handleDeleteTriggerRef.current = handleDeleteTrigger;
    handleMoveTriggerRef.current = handleMoveTrigger;
    handleBulkMoveTriggerRef.current = handleBulkMoveTrigger;
    previewBookmarkRef.current = previewBookmark;
    openPreviewRef.current = openPreview;
    closePreviewRef.current = closePreview;
  });

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (editDialogOpenRef.current || moveDialogOpenRef.current) return;

      if (e.key === "Escape" && previewBookmarkRef.current) {
        e.preventDefault();
        closePreviewRef.current();
        return;
      }

      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement === inputRef.current ||
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA";
      const key = e.key.toLowerCase();

      if (isInputFocused) {
        if ((e.metaKey || e.ctrlKey) && key === "k") {
          e.preventDefault();
          inputRef.current?.focus();
        }
        return;
      }

      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (manageTagsDialogOpenRef.current) return;
        e.preventDefault();
        setShortcutsOpen((v) => !v);
        return;
      }

      if (shortcutsOpenRef.current || manageTagsDialogOpenRef.current) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }

      const items = bookmarksRef.current;
      if (items.length === 0) return;
      const activeIdx = focusedIndexRef.current;

      // List shortcuts work regardless of where DOM focus is, except inside
      // widgets that own arrow/character keys themselves.
      const target =
        activeElement instanceof HTMLElement ? activeElement : null;
      const isNeutral =
        !target || target === document.body || target === sectionRef.current;
      if (
        activeElement?.closest("select, [role='listbox'], [role='menu']") ||
        target?.isContentEditable
      ) {
        return;
      }

      if (isSelectionModeRef.current) {
        if ((e.metaKey || e.ctrlKey) && key === "a") {
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

        if ((e.metaKey || e.ctrlKey) && key === "c") {
          e.preventDefault();
          navigator.clipboard.writeText(item.url);
          toast.success("URL copied to clipboard");
          return;
        }

        if ((e.metaKey || e.ctrlKey) && key === "e") {
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

      const noModifiers = !e.metaKey && !e.ctrlKey && !e.altKey;

      // ⌘M minimizes the window on macOS and Ctrl+M mutes the tab in
      // Firefox, so move is a plain key.
      if (key === "m" && noModifiers) {
        e.preventDefault();
        if (isSelectionModeRef.current && selectedIdsRef.current.length > 0) {
          handleBulkMoveTriggerRef.current();
        } else if (activeIdx >= 0) {
          const item = items[activeIdx];
          if (item) handleMoveTriggerRef.current(item.id);
        }
        return;
      }

      if (key === "x" && noModifiers && !e.shiftKey) {
        const isOnItem = target?.hasAttribute("data-bookmark-item") ?? false;
        if ((isNeutral || isOnItem) && activeIdx >= 0) {
          e.preventDefault();
          if (!isSelectionModeRef.current) setIsSelectionMode(true);
          const item = items[activeIdx];
          if (item) toggleSelectRef.current(item.id);
        }
        return;
      }

      const isCard = viewRef.current === "card";
      const isNext =
        e.key === "ArrowDown" || (isCard && e.key === "ArrowRight");
      const isPrev = e.key === "ArrowUp" || (isCard && e.key === "ArrowLeft");

      if (isNext || isPrev) {
        e.preventDefault();
        if (e.shiftKey) {
          // Shift+arrows extend the selection, entering selection mode on
          // first use. Additive: reversing direction keeps prior picks.
          const start =
            activeIdx < 0 ? (isNext ? 0 : items.length - 1) : activeIdx;
          const next = isNext
            ? Math.min(start + 1, items.length - 1)
            : Math.max(start - 1, 0);
          if (!isSelectionModeRef.current) setIsSelectionMode(true);
          setSelectedIds((prev) => {
            const set = new Set(prev);
            const startItem = items[start];
            const nextItem = items[next];
            if (startItem) set.add(startItem.id);
            if (nextItem) set.add(nextItem.id);
            return Array.from(set);
          });
          setFocusedIndex(next);
        } else {
          setFocusedIndex((prev) => {
            if (isNext) return prev < items.length - 1 ? prev + 1 : prev;
            return prev > 0 ? prev - 1 : 0;
          });
        }
        return;
      }

      if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        setFocusedIndex(e.key === "Home" ? 0 : items.length - 1);
        return;
      }

      if (e.key === "PageDown" || e.key === "PageUp") {
        e.preventDefault();
        const scroller = sectionRef.current?.querySelector(
          "[data-virtual-scroll]",
        );
        const rowHeight = ROW_PITCH[viewRef.current];
        const pageSize = Math.max(
          1,
          Math.floor(
            (scroller?.clientHeight ?? window.innerHeight) / rowHeight,
          ),
        );
        setFocusedIndex((prev) => {
          const cur = prev < 0 ? 0 : prev;
          const next = e.key === "PageDown" ? cur + pageSize : cur - pageSize;
          return Math.max(0, Math.min(items.length - 1, next));
        });
        return;
      }

      if (e.key === "Enter" && activeIdx >= 0 && noModifiers && !e.shiftKey) {
        // On a bookmark item, native button activation already opens the
        // URL — handling Enter here too would open it twice. Any other
        // interactive element keeps its own Enter behavior; only from a
        // neutral spot (body/section) does Enter open the focused item.
        if (!isNeutral) return;
        const item = items[activeIdx];
        if (!item) return;
        e.preventDefault();
        if (isSelectionModeRef.current) toggleSelectRef.current(item.id);
        else openPreviewRef.current(item.id);
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
  }, [sectionRef]);

  // Roving tabindex: arrow keys move real DOM focus to the focused item so
  // screen readers follow and :focus-visible rings appear. Virtualized rows
  // that aren't mounted yet get scrolled into range first.
  useEffect(() => {
    if (focusedIndex < 0) return;
    const section = sectionRef.current;
    const bookmark = bookmarksRef.current[focusedIndex];
    if (!section || !bookmark) return;

    const focusItem = (): boolean => {
      const btn = section.querySelector<HTMLElement>(
        `[data-bookmark-id="${bookmark.id}"]`,
      );
      if (!btn) return false;
      btn.focus({ preventScroll: true });
      btn.scrollIntoView({ block: "nearest" });
      return true;
    };

    if (focusItem()) return;

    const scroller = section.querySelector<HTMLElement>(
      "[data-virtual-scroll]",
    );
    if (!scroller) return;
    const rowHeight = ROW_PITCH[viewRef.current];
    scroller.scrollTop = Math.max(
      0,
      focusedIndex * rowHeight - scroller.clientHeight / 2,
    );
    requestAnimationFrame(() => {
      if (!focusItem()) requestAnimationFrame(focusItem);
    });
  }, [focusedIndex, sectionRef]);

  // Restore focus to the element that opened a dialog when it closes.
  const wasDialogOpenRef = useRef(false);
  useEffect(() => {
    const isOpen = editDialogOpen || moveDialogOpen;
    if (wasDialogOpenRef.current && !isOpen) {
      const trigger = lastTriggerRef.current;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      lastTriggerRef.current = null;
    }
    wasDialogOpenRef.current = isOpen;
  }, [editDialogOpen, moveDialogOpen]);

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

  const addBookmarkFromUrl = (rawUrl: string): boolean => {
    const trimmed = rawUrl.trim();
    if (!isUrlLike(trimmed)) return false;
    const targetWorkspace =
      currentWorkspace ??
      workspaces.find((ws) => ws.is_default) ??
      workspaces[0];
    if (!targetWorkspace) {
      toast.error("Please create a workspace first");
      return false;
    }
    const normalizedUrl = trimmed.startsWith("http")
      ? trimmed
      : `https://${trimmed}`;
    mutations.addBookmark(
      { url: normalizedUrl, workspaceId: targetWorkspace.id },
      {
        onSuccess: () => invalidate(),
        onError: () => toast.error("Failed to add bookmark"),
      },
    );
    return true;
  };

  const handleSubmit = (val: string) => {
    if (addBookmarkFromUrl(val)) setSearchQuery("");
  };

  const addBookmarkFromUrlRef = useRef(addBookmarkFromUrl);
  useEffect(() => {
    addBookmarkFromUrlRef.current = addBookmarkFromUrl;
  });

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Any open dialog keeps native paste semantics; a DOM check also
      // covers dialogs this hook doesn't own (settings, delete confirms).
      if (document.querySelector("[role='dialog']")) return;
      const activeElement = document.activeElement;
      if (
        activeElement === inputRef.current ||
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA" ||
        activeElement?.closest("select, [role='listbox'], [role='menu']") ||
        (activeElement instanceof HTMLElement &&
          activeElement.isContentEditable)
      ) {
        return;
      }
      const text = e.clipboardData?.getData("text/plain").trim() ?? "";
      // Single-token URLs only: pasted prose containing a dot must not
      // become a bookmark.
      if (!text || /\s/.test(text) || !isUrlLike(text)) return;
      e.preventDefault();
      addBookmarkFromUrlRef.current(text);
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

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
    focusedIndex,
    previewBookmark,
    openPreview,
    closePreview,
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
    shortcutsOpen,
    setShortcutsOpen,
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
