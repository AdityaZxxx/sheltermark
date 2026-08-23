"use client";

import { useEffect, useRef, useState } from "react";

export function useExitAnimation<T extends { id: string }>(
  items: T[],
  duration = 150,
  resetKey?: string,
) {
  const [exiting, setExiting] = useState<T[]>([]);
  const prevItemsRef = useRef<T[]>(items);
  const prevResetKeyRef = useRef(resetKey);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => {
    // A changed resetKey means items vanished due to filtering/navigation,
    // not deletion — skip the exit animation and drop any rows still
    // animating out from a previous change.
    if (prevResetKeyRef.current !== resetKey) {
      prevResetKeyRef.current = resetKey;
      prevItemsRef.current = items;
      clearTimeout(timeoutRef.current);
      setExiting([]);
      return;
    }

    const currIds = new Set(items.map((i) => i.id));

    const removed = prevItemsRef.current.filter((i) => !currIds.has(i.id));
    if (removed.length > 0) {
      setExiting((prev) => [...prev, ...removed]);
      const removedIds = new Set(removed.map((r) => r.id));
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setExiting((prev) => prev.filter((e) => !removedIds.has(e.id)));
      }, duration);
    }

    prevItemsRef.current = items;
  }, [items, duration, resetKey]);

  // Clear only on unmount — clearing per effect run would cancel pending
  // removals when items change again before the timeout fires.
  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  return { exiting };
}
