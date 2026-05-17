"use client";

import { useCallback, useRef, useState } from "react";

interface UseBookmarkKeyboardOptions {
  itemCount: number;
  view: "list" | "card";
  onSelect?: (id: string) => void;
  onOpen?: (url: string) => void;
  isSelectionMode?: boolean;
}

export function useBookmarkKeyboardNavigation({
  itemCount,
  view,
  onSelect,
  onOpen,
  isSelectionMode = false,
}: UseBookmarkKeyboardOptions) {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
    setFocusedIndex(-1);
  }, []);

  const handleKeyDown = useCallback(
    (
      e: React.KeyboardEvent,
      getItem?: (index: number) => { id: string; url: string } | undefined,
    ) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        focusInput();
        return;
      }

      if (
        document.activeElement === inputRef.current ||
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (itemCount === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((prev) => (prev < itemCount - 1 ? prev + 1 : prev));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (view === "card") {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          setFocusedIndex((prev) => (prev < itemCount - 1 ? prev + 1 : prev));
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        }
      }

      if (e.key === "Enter" && focusedIndex >= 0 && getItem) {
        const item = getItem(focusedIndex);
        if (item) {
          if (isSelectionMode && onSelect) {
            onSelect(item.id);
          } else if (onOpen) {
            onOpen(item.url);
          }
        }
      }
    },
    [
      itemCount,
      view,
      focusedIndex,
      isSelectionMode,
      onSelect,
      onOpen,
      focusInput,
    ],
  );

  return {
    focusedIndex,
    setFocusedIndex,
    inputRef,
    focusInput,
    handleKeyDown,
  };
}
