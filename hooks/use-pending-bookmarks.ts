"use client";

import { useEffect, useState } from "react";
import type { Bookmark } from "~/lib/schemas/bookmark.schema";
import { normalizeUrl } from "~/lib/utils";

export function usePendingBookmarks(filteredBookmarks: Bookmark[]) {
  const [pendingUrls, setPendingUrls] = useState<{ id: string; url: string }[]>(
    [],
  );

  useEffect(() => {
    setPendingUrls((prev) =>
      prev.filter(
        (p) =>
          !filteredBookmarks.some(
            (b: Bookmark) => normalizeUrl(b.url) === normalizeUrl(p.url),
          ),
      ),
    );
  }, [filteredBookmarks]);

  return { pendingUrls, setPendingUrls };
}
