"use client";

import { GlobeIcon } from "@phosphor-icons/react";
import { Kbd, KbdGroup } from "~/components/ui/kbd";
interface BookmarkCardItemProps {
  title: string;
  url: string;
  og_image_url?: string;
  favicon_url?: string;
  domain: string;
  created_at: string;
}

export function BookmarkCardItem({
  title,
  url,
  og_image_url,
  favicon_url,
  domain,
  created_at,
}: BookmarkCardItemProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col rounded-sm overflow-hidden  hover:bg-muted/50 h-full"
    >
      <div className="aspect-1200/628 w-full bg-muted overflow-hidden relative">
        {og_image_url ? (
          <img
            src={og_image_url}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <GlobeIcon className="w-12 h-12 text-muted-foreground/20" />
          </div>
        )}
        <div className="absolute bottom-0.5 left-1 right-1 bg-black/60 px-2 py-1 mx-auto ">
          <h3 className="text-[10px] text-white truncate leading-none font-medium">
            {title}
          </h3>
        </div>
      </div>
      <div className="flex items-center px-4 py-3  justify-between">
        <div className="flex gap-2">
          {favicon_url ? (
            <img
              src={favicon_url}
              alt={`${domain} favicon`}
              className="w-4 h-4 object-contain"
            />
          ) : (
            <GlobeIcon className="w-4 h-4 text-muted-foreground" />
          )}
          <p className="text-xs font-medium text-muted-foreground truncate">
            {domain}
          </p>
        </div>
        <div className="grid grid-cols-1 grid-rows-1 place-items-center shrink-0 min-w-[80px]">
          <p className="col-start-1 row-start-1 text-xs text-muted-foreground transition-opacity group-hover:opacity-0">
            {new Date(created_at).toLocaleDateString()}
          </p>
          <KbdGroup className="col-start-1 row-start-1 text-xs transition-opacity opacity-0 group-hover:opacity-100 pointer-events-none">
            <Kbd>Ctrl</Kbd>
            <span>+</span>
            <Kbd>B</Kbd>
          </KbdGroup>
        </div>
      </div>
    </a>
  );
}
