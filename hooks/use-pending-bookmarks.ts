"use client";

import { useState } from "react";

import type { Bookmark } from "~/lib/schemas/bookmark.schema";

import { normalizeUrl } from "~/lib/utils";

export function usePendingBookmarks(filteredBookmarks: Bookmark[]) {
  const [pendingUrls, setPendingUrls] = useState<{ id: string; url: string }[]>(
    [],
  );

  // Hanya filter pending URL yang URL-nya udah cocok sama bookmark
  // REAL (bukan optimistic/temp). Optimistic bookmark dari useAddBookmark
  // pake ID "temp-*", jadi loading card tetap kelihatan sampe
  // invalidateQueries ngembaliin data beneran dari Supabase.
  const visiblePendingUrls = pendingUrls.filter(
    (p) =>
      !filteredBookmarks.some(
        (b) =>
          !b.id.startsWith("temp-") &&
          normalizeUrl(b.url) === normalizeUrl(p.url),
      ),
  );

  return { pendingUrls: visiblePendingUrls, setPendingUrls };
}
