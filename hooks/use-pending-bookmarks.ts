"use client";

import { useEffect, useState } from "react";
import type { Bookmark } from "~/lib/schemas/bookmark";
import { normalizeUrl } from "~/lib/utils";

export function usePendingBookmarks(filteredBookmarks: Bookmark[]) {
  const [pendingUrls, setPendingUrls] = useState<{ id: string; url: string }[]>(
    [],
  );

  useEffect(() => {
    if (pendingUrls.length === 0) return;
    setPendingUrls((prev) =>
      prev.filter(
        (p) =>
          !filteredBookmarks.some(
            (b: Bookmark) => normalizeUrl(b.url) === normalizeUrl(p.url),
          ),
      ),
    );
  }, [filteredBookmarks, pendingUrls.length]);

  return { pendingUrls, setPendingUrls };
}
