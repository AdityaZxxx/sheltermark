"use client";

import {
  CaretRightIcon,
  SlidersHorizontalIcon,
  TagIcon,
} from "@phosphor-icons/react";
import { useCallback, useState } from "react";

import type { BookmarkViewVariant } from "~/lib/schemas/common";

import { Button } from "~/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "~/components/ui/drawer";

import type { BookmarkSort } from "../../lib/schemas/bookmark.schema";

import { BookmarkSortSelect } from "./bookmark-sort";
import { BookmarkViewToggle } from "./bookmark-view-toggle";

interface BookmarkMobileControlsProps {
  sort: BookmarkSort;
  view: BookmarkViewVariant;
  onSortChange: (sort: BookmarkSort) => void;
  onViewChange: (view: BookmarkViewVariant) => void;
  onManageTags?: () => void;
}

export function BookmarkMobileControls({
  sort,
  view,
  onSortChange,
  onViewChange,
  onManageTags,
}: BookmarkMobileControlsProps) {
  const [open, setOpen] = useState(false);

  const handleManageTags = useCallback(() => {
    if (!onManageTags) return;
    // Close the drawer first so the tag dialog doesn't layer on top of a
    // second backdrop. The dialog opens on the next tick after the drawer
    // begins its exit transition — feels snappy, no visible double-backdrop.
    setOpen(false);
    requestAnimationFrame(() => onManageTags());
  }, [onManageTags]);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        render={
          <Button
            variant="secondary"
            aria-label="Display & sort options"
            className="active:scale-[0.96] transition-transform"
          />
        }
      >
        <SlidersHorizontalIcon className="size-3.5" />
      </DrawerTrigger>
      <DrawerContent className="max-h-[80dvh]">
        <DrawerHeader>
          <DrawerTitle className="text-balance">Display &amp; Sort</DrawerTitle>
          <DrawerDescription className="sr-only">
            Choose how bookmarks are shown and ordered.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col gap-5 p-4 pt-3 overflow-y-auto">
          <section className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              View
            </span>
            <BookmarkViewToggle
              view={view}
              onViewChange={onViewChange}
              className="w-full"
            />
          </section>

          <section className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Sort by
            </span>
            <div className="w-full">
              <BookmarkSortSelect sort={sort} onSortChange={onSortChange} />
            </div>
          </section>

          {onManageTags && (
            <button
              type="button"
              onClick={handleManageTags}
              className="-mx-4 -mb-4 mt-1 flex items-center gap-3 border-t border-border/60 px-4 py-3.5 text-left transition-colors hover:bg-muted/40 active:scale-[0.99] transition-[background-color,transform] duration-100 ease-out"
            >
              <TagIcon
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="flex-1 text-sm text-foreground">
                Manage tags
              </span>
              <CaretRightIcon
                className="size-3.5 text-muted-foreground/60"
                aria-hidden="true"
              />
            </button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
