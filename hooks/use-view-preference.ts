"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import type { BookmarkViewVariant } from "~/lib/schemas/common";

const VIEW_PREFERENCE_KEY = "sheltermark-view-preference";

function isBookmarkViewVariant(value: string): value is BookmarkViewVariant {
  return value === "list" || value === "card" || value === "comfort";
}

function getStored(): BookmarkViewVariant {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- standard Next.js SSR guard
  if (typeof window === "undefined") return "list";
  try {
    const stored = localStorage.getItem(VIEW_PREFERENCE_KEY);
    if (stored !== null && isBookmarkViewVariant(stored)) {
      return stored;
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
