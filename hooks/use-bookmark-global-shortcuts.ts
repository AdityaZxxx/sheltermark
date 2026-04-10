"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Bookmark } from "~/lib/schemas/bookmark";

interface UseBookmarkGlobalShortcutsProps {
  inputRef: React.RefObject<HTMLInputElement | null>;
  filteredBookmarks: Bookmark[];
  focusedIndex: number;
  isSelectionMode: boolean;
  renameDialogOpen: boolean;
  deleteDialogOpen: boolean;
  selectAll: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;
  handleRenameTrigger: (id: string, bookmarks: Bookmark[]) => void;
  handleBulkDeleteTrigger: (ids: string[]) => void;
}

export function useBookmarkGlobalShortcuts({
  inputRef,
  filteredBookmarks,
  focusedIndex,
  isSelectionMode,
  renameDialogOpen,
  deleteDialogOpen,
  selectAll,
  toggleSelect,
  clearSelection,
  handleRenameTrigger,
  handleBulkDeleteTrigger,
}: UseBookmarkGlobalShortcutsProps) {
  const filteredBookmarksRef = useRef(filteredBookmarks);
  const isSelectionModeRef = useRef(isSelectionMode);
  const focusedIndexRef = useRef(focusedIndex);
  const deleteDialogOpenRef = useRef(deleteDialogOpen);
  const renameDialogOpenRef = useRef(renameDialogOpen);

  useEffect(() => {
    filteredBookmarksRef.current = filteredBookmarks;
  }, [filteredBookmarks]);

  useEffect(() => {
    isSelectionModeRef.current = isSelectionMode;
  }, [isSelectionMode]);

  useEffect(() => {
    focusedIndexRef.current = focusedIndex;
  }, [focusedIndex]);

  useEffect(() => {
    deleteDialogOpenRef.current = deleteDialogOpen;
    renameDialogOpenRef.current = renameDialogOpen;
  }, [deleteDialogOpen, renameDialogOpen]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (renameDialogOpenRef.current) return;

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
          handleRenameTrigger(item.id, filteredBookmarksRef.current);
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
    handleRenameTrigger,
    handleBulkDeleteTrigger,
  ]);
}
