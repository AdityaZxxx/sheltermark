"use client";

import { useEffect, useRef, useState } from "react";

export function useExitAnimation<T extends { id: string }>(
  items: T[],
  duration = 150,
) {
  const [exiting, setExiting] = useState<T[]>([]);
  const prevItemsRef = useRef<T[]>(items);

  useEffect(() => {
    const currIds = new Set(items.map((i) => i.id));

    const removed = prevItemsRef.current.filter((i) => !currIds.has(i.id));
    if (removed.length > 0) {
      setExiting((prev) => [...prev, ...removed]);
      const removedIds = new Set(removed.map((r) => r.id));
      setTimeout(() => {
        setExiting((prev) => prev.filter((e) => !removedIds.has(e.id)));
      }, duration);
    }

    prevItemsRef.current = items;
  }, [items, duration]);

  return { exiting, setExiting };
}
