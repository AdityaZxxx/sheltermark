"use client";

import type { z } from "zod";

import { useEffect, useState, useTransition } from "react";

import { bookmarkViewVariantSchema } from "~/lib/schemas/common";

type BookmarkViewVariant = z.infer<typeof bookmarkViewVariantSchema>;

const VIEW_PREFERENCE_KEY = "sheltermark-view-preference";

function getStored(): BookmarkViewVariant {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- standard Next.js SSR guard
  if (typeof window === "undefined") return "list";
  try {
    const stored = localStorage.getItem(VIEW_PREFERENCE_KEY);
    if (stored !== null) {
      const parsed = bookmarkViewVariantSchema.safeParse(stored);
      if (parsed.success) return parsed.data;
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
    // oxlint-disable-next-line react/set-state-in-effect -- hydration-safe localStorage read: initializing state from storage during render would mismatch the SSR default
    setViewRaw(getStored());
  }, []);

  const setView = (newView: BookmarkViewVariant) => {
    startTransition(() => {
      setViewRaw(newView);
    });
    try {
      localStorage.setItem(VIEW_PREFERENCE_KEY, newView);
    } catch {
      /* localStorage may be blocked */
    }
  };

  return { view, setView };
}
