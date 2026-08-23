"use client";

import { useEffect, useState } from "react";

export function useBookmarkSelection() {
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

  const selectAll = (ids: string[]) => {
    setSelectedIds(ids);
  };

  const clearSelection = () => {
    setSelectedIds([]);
    setIsSelectionMode(false);
  };

  const clearSelectionOnly = () => {
    setSelectedIds([]);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSelectionMode) {
        setSelectedIds([]);
        setIsSelectionMode(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSelectionMode]);

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
