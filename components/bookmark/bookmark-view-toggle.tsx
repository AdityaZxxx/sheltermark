import { ListIcon, RowsIcon, SquaresFourIcon } from "@phosphor-icons/react";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import type { BookmarkViewVariant } from "~/lib/schemas/common";
import { cn } from "~/lib/utils";

interface BookmarkViewToggleProps {
  view: BookmarkViewVariant;
  onViewChange: (view: BookmarkViewVariant) => void;
  className?: string;
}

export function BookmarkViewToggle({
  view,
  onViewChange,
  className,
}: BookmarkViewToggleProps) {
  return (
    <Tabs
      value={view}
      onValueChange={(v) => onViewChange(v as BookmarkViewVariant)}
    >
      <TabsList
        className={cn("grid grid-cols-3 bg-muted/60 rounded-lg", className)}
      >
        <TabsTrigger
          value="list"
          className="rounded-md data-active:bg-background data-active:shadow-sm"
        >
          <ListIcon className="h-4 w-4" />{" "}
          <span className="block md:hidden">List </span>
        </TabsTrigger>
        <TabsTrigger
          value="comfort"
          className="rounded-md data-active:bg-background data-active:shadow-sm"
        >
          <RowsIcon className="size-4" />{" "}
          <span className="block md:hidden">Comfort</span>
        </TabsTrigger>
        <TabsTrigger
          value="card"
          className="rounded-md data-active:bg-background data-active:shadow-sm"
        >
          <SquaresFourIcon className="h-4 w-4" />{" "}
          <span className="block md:hidden">Gallery</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
