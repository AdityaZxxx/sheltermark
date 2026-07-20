"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

interface VirtualListProps<T> {
  items: T[];
  estimateSize: number;
  renderItem: (item: T, index: number) => ReactNode;
  overscan?: number;
  gap?: number;
}

export function VirtualList<T extends { id: string }>({
  items,
  estimateSize,
  renderItem,
  overscan = 5,
  gap = 0,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(
    typeof window !== "undefined" ? window.innerHeight - 100 : 600,
  );

  useLayoutEffect(() => {
    function update() {
      if (parentRef.current) {
        const rect = parentRef.current.getBoundingClientRect();
        setListHeight(window.innerHeight - rect.top);
      }
    }
    update();
    window.addEventListener("resize", update);
    const observer = new ResizeObserver(update);
    const parent = parentRef.current?.parentElement;
    if (parent) {
      observer.observe(parent);
    }
    return () => {
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, []);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    measureElement: (el) => {
      const h = el.getBoundingClientRect().height;
      return h > 0 ? h : estimateSize;
    },
    overscan,
    getItemKey: (index) => items[index]?.id ?? index,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalGap = gap > 0 ? Math.max(0, items.length - 1) * gap : 0;

  return (
    <>
      <style>{`[data-virtual-scroll]::-webkit-scrollbar { display: none; }`}</style>
      <div
        ref={parentRef}
        data-virtual-scroll
        style={{
          height: listHeight > 0 ? `${listHeight}px` : "auto",
          overflowY: "auto",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          contain: "layout paint style",
        }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize() + totalGap}px`,
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
                  transform: `translateY(${virtualItem.start + virtualItem.index * gap}px)`,
                  marginBottom: gap > 0 ? `${gap}px` : undefined,
                }}
              >
                {renderItem(item, virtualItem.index)}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
