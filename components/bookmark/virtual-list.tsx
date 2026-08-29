"use client";

import type { ReactNode, RefObject } from "react";

import { useVirtualizer } from "@tanstack/react-virtual";

interface VirtualListProps<T> {
  items: T[];
  estimateSize: number;
  renderItem: (item: T, index: number) => ReactNode;
  overscan?: number;
  gap?: number;
  scrollRef: RefObject<HTMLDivElement | null>;
}

export function VirtualList<T extends { id: string }>({
  items,
  estimateSize,
  renderItem,
  overscan = 5,
  gap = 0,
  scrollRef,
}: VirtualListProps<T>) {
  // @tanstack/react-virtual mutates options during render internally, which
  // the React Compiler cannot memoize — opt this component out explicitly.
  "use no memo";

  // oxlint-disable-next-line react/incompatible-library -- @tanstack/react-virtual mutates options during render; component is opted out of the compiler via "use no memo"
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    measureElement: (el) => {
      const h = el.getBoundingClientRect().height;
      return h > 0 ? h : estimateSize;
    },
    overscan,
    gap,
    getItemKey: (index) => items[index]?.id ?? index,
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      style={{
        height: `${virtualizer.getTotalSize()}px`,
        position: "relative",
      }}
    >
      {virtualItems.map((virtualItem) => {
        const item = items[virtualItem.index];
        if (!item) return null;
        return (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {renderItem(item, virtualItem.index)}
          </div>
        );
      })}
    </div>
  );
}
