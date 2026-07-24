"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import type { BookmarkViewVariant } from "~/lib/schemas/common";

const VIEW_PREFERENCE_KEY = "sheltermark-view-preference";

function getStored(): BookmarkViewVariant {
  if (typeof window === "undefined") return "list";
  try {
    const stored = localStorage.getItem(VIEW_PREFERENCE_KEY);
    const valid: BookmarkViewVariant[] = ["list", "card", "comfort"];
    if (stored && valid.includes(stored as BookmarkViewVariant)) {
      return stored as BookmarkViewVariant;
    }
  } catch {
    /* localStorage may be blocked */
  }
  return "list";
}

export function useViewPreference() {
  const [view, setViewRaw] = useState<BookmarkViewVariant>("list");
  const [, startTransition] = useTransition();

  useEffect(() => {
    setViewRaw(getStored());
  }, []);

  const setView = useCallback((newView: BookmarkViewVariant) => {
    startTransition(() => {
      setViewRaw(newView);
    });
    try {
      localStorage.setItem(VIEW_PREFERENCE_KEY, newView);
    } catch {
      /* localStorage may be blocked */
    }
  }, []);

  return { view, setView };
}
