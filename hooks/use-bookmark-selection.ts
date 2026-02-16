"use client";

import { useCallback, useEffect, useState } from "react";

export function useBookmarkSelection() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode((prev) => {
      if (prev) {
        setSelectedIds([]);
      }
      return !prev;
    });
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(ids);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
    setIsSelectionMode(false);
  }, []);

  const clearSelectionOnly = useCallback(() => {
    setSelectedIds([]);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSelectionMode) {
        clearSelection();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSelectionMode, clearSelection]);

  return {
    selectedIds,
    isSelectionMode,
    setIsSelectionMode,
    toggleSelectionMode,
    toggleSelect,
    selectAll,
    clearSelection,
    clearSelectionOnly,
  };
}
