import { ListIcon, RowsIcon, SquaresFourIcon } from "@phosphor-icons/react";

import type { BookmarkViewVariant } from "~/lib/schemas/common";

import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { cn } from "~/lib/utils";

interface BookmarkViewToggleProps {
  view: BookmarkViewVariant;
  onViewChange: (view: BookmarkViewVariant) => void;
  className?: string;
  /**
   * Show the variant label next to the icon below `md`. Set `false` to keep
   * the toggle icon-only on small screens (e.g. the public profile toolbar).
   * Accessible names come from `aria-label` on each trigger, so hiding the
   * visible label is safe.
   */
  showLabels?: boolean;
}

export function BookmarkViewToggle({
  view,
  onViewChange,
  className,
  showLabels = true,
}: BookmarkViewToggleProps) {
  return (
    <Tabs
      value={view}
      onValueChange={(v) =>
        // SAFETY: triggers render only the three BookmarkViewVariant values above; the callback never receives anything else.
        onViewChange(v as BookmarkViewVariant)
      }
    >
      <TabsList
        className={cn("grid grid-cols-3 bg-muted/60 rounded-lg", className)}
      >
        <TabsTrigger value="list" className="rounded-md" aria-label="List view">
          <ListIcon className="h-4 w-4" />{" "}
          {showLabels && <span className="md:hidden">List</span>}
        </TabsTrigger>
        <TabsTrigger
          value="comfort"
          className="rounded-md"
          aria-label="Comfort view"
        >
          <RowsIcon className="size-4" />{" "}
          {showLabels && <span className="md:hidden">Comfort</span>}
        </TabsTrigger>
        <TabsTrigger
          value="card"
          className="rounded-md"
          aria-label="Gallery view"
        >
          <SquaresFourIcon className="h-4 w-4" />{" "}
          {showLabels && <span className="md:hidden">Gallery</span>}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
