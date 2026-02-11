"use client";

import { ListIcon, SquaresFourIcon } from "@phosphor-icons/react";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";

interface BookmarkViewToggleProps {
  view: "list" | "card";
  onViewChange: (view: "list" | "card") => void;
}

export function BookmarkViewToggle({
  view,
  onViewChange,
}: BookmarkViewToggleProps) {
  return (
    <Tabs
      value={view}
      onValueChange={(v) => onViewChange(v as "list" | "card")}
    >
      <TabsList className="grid w-24 grid-cols-2 bg-muted/60 p-1 rounded-lg">
        <TabsTrigger
          value="list"
          className="rounded-md data-active:bg-background data-active:shadow-sm"
        >
          <ListIcon className="h-4 w-4" />
        </TabsTrigger>
        <TabsTrigger
          value="card"
          className="rounded-md data-active:bg-background data-active:shadow-sm"
        >
          <SquaresFourIcon className="h-4 w-4" />
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
