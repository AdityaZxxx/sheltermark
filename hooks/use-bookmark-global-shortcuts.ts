"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Bookmark } from "~/lib/schemas/bookmark.schema";
import type { Tag } from "~/lib/schemas/tag.schema";

interface UseBookmarkGlobalShortcutsProps {
  inputRef: React.RefObject<HTMLInputElement | null>;
  filteredBookmarks: Bookmark[];
  tagsByBookmarkId: Map<string, string[]>;
  allTags: Tag[];
  focusedIndex: number;
  isSelectionMode: boolean;
  editDialogOpen: boolean;
  deleteDialogOpen: boolean;
  selectAll: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;
  handleEditTrigger: (
    id: string,
    bookmarks: Array<{
      id: string;
      title: string | null;
      note: string | null;
      tagsByBookmarkId: Map<string, string[]>;
      allTags: Tag[];
    }>,
  ) => void;
  handleBulkDeleteTrigger: (ids: string[]) => void;
}

export function useBookmarkGlobalShortcuts({
  inputRef,
  filteredBookmarks,
  tagsByBookmarkId,
  allTags,
  focusedIndex,
  isSelectionMode,
  editDialogOpen,
  deleteDialogOpen,
  selectAll,
  toggleSelect,
  clearSelection,
  handleEditTrigger,
  handleBulkDeleteTrigger,
}: UseBookmarkGlobalShortcutsProps) {
  const filteredBookmarksRef = useRef(filteredBookmarks);
  const tagsByBookmarkIdRef = useRef(tagsByBookmarkId);
  const allTagsRef = useRef(allTags);
  const isSelectionModeRef = useRef(isSelectionMode);
  const focusedIndexRef = useRef(focusedIndex);
  const deleteDialogOpenRef = useRef(deleteDialogOpen);
  const editDialogOpenRef = useRef(editDialogOpen);

  useEffect(() => {
    filteredBookmarksRef.current = filteredBookmarks;
  }, [filteredBookmarks]);

  useEffect(() => {
    tagsByBookmarkIdRef.current = tagsByBookmarkId;
  }, [tagsByBookmarkId]);

  useEffect(() => {
    allTagsRef.current = allTags;
  }, [allTags]);

  useEffect(() => {
    isSelectionModeRef.current = isSelectionMode;
  }, [isSelectionMode]);

  useEffect(() => {
    focusedIndexRef.current = focusedIndex;
  }, [focusedIndex]);

  useEffect(() => {
    deleteDialogOpenRef.current = deleteDialogOpen;
    editDialogOpenRef.current = editDialogOpen;
  }, [deleteDialogOpen, editDialogOpen]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (editDialogOpenRef.current) return;

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

      const items = filteredBookmarksRef.current;
      if (items.length === 0) return;

      const activeIdx = focusedIndexRef.current;

      if (isSelectionModeRef.current) {
        if ((e.metaKey || e.ctrlKey) && e.key === "a") {
          e.preventDefault();
          const allIds = items.map((b: Bookmark) => b.id);
          selectAll(allIds);
          return;
        }
        if (e.key === " " && activeIdx >= 0) {
          e.preventDefault();
          const item = items[activeIdx];
          if (item) toggleSelect(item.id);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          clearSelection();
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
          handleEditTrigger(
            item.id,
            filteredBookmarksRef.current.map((b) => ({
              id: b.id,
              title: b.title,
              note: b.note,
              tagsByBookmarkId: tagsByBookmarkIdRef.current,
              allTags: allTagsRef.current,
            })),
          );
          return;
        }

        if ((e.metaKey || e.ctrlKey) && e.key === "Backspace") {
          e.preventDefault();
          handleBulkDeleteTrigger([item.id]);
          return;
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [
    inputRef,
    selectAll,
    toggleSelect,
    clearSelection,
    handleEditTrigger,
    handleBulkDeleteTrigger,
  ]);
}
