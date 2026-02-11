"use client";

import { GlobeIcon } from "@phosphor-icons/react";
import { Kbd, KbdGroup } from "../ui/kbd";

interface BookmarkListItemProps {
  title: string;
  url: string;
  favicon_url?: string;
  domain: string;
  created_at: string;
}

export function BookmarkListItem({
  title,
  url,
  favicon_url,
  domain,
  created_at,
}: BookmarkListItemProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-all"
    >
      <div className="shrink-0 w-6 h-6 rounded-md overflow-hidden flex items-center justify-center">
        {favicon_url ? (
          <img src={favicon_url} alt="" className="w-4 h-4 object-contain" />
        ) : (
          <GlobeIcon className="w-4 h-4 text-muted-foreground" />
        )}
      </div>

      <div className="flex-1 flex items-center justify-between min-w-0">
        <div className="flex-1 min-w-0 flex items-center gap-2 mr-2">
          <p className="text-sm font-medium truncate text-foreground group-hover:text-primary transition-colors min-w-0">
            {title}
          </p>
          <p className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
            {domain}
          </p>
        </div>

        <div className="relative shrink-0 ml-10 text-xs text-muted-foreground">
          <span className="transition-opacity group-hover:opacity-0">
            {new Date(created_at).toLocaleDateString()}
          </span>

          <KbdGroup className="absolute inset-0 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <Kbd>Ctrl</Kbd>
            <span>+</span>
            <Kbd>B</Kbd>
          </KbdGroup>
        </div>
      </div>
    </a>
  );
}
