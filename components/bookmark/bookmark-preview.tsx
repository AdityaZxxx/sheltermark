"use client";

import {
  ArrowClockwiseIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowSquareOutIcon,
  GlobeIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import type { Bookmark } from "~/lib/schemas/bookmark.schema";

import { checkEmbeddable } from "~/app/action/bookmark.action";
import { Button } from "~/components/ui/button";
import { safeDomain } from "~/lib/utils";
import { cn } from "~/lib/utils";

import { Orb } from "./orb";

// Sites that refuse embedding (X-Frame-Options / CSP) still fire load in some
// browsers, so this timeout is a heuristic — the fallback stays dismissible.
const LOAD_TIMEOUT_MS = 10_000;
const EXIT_MS = 150;

interface BookmarkPreviewProps {
  bookmark: Bookmark;
  onClose: () => void;
}

export function BookmarkPreview({ bookmark, onClose }: BookmarkPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const loadedRef = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [headerBlocked, setHeaderBlocked] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!loadedRef.current) setTimedOut(true);
    }, LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    checkEmbeddable({ url: bookmark.url }).then((res) => {
      if (!cancelled && res.success && res.data.embeddable === false) {
        setHeaderBlocked(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [bookmark.url]);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, []);

  const close = () => {
    setClosing(true);
    setTimeout(onClose, EXIT_MS);
  };

  const openExternal = () => {
    window.open(bookmark.url, "_blank", "noopener,noreferrer");
  };

  // history.back/forward/go and location.reload are callable cross-origin;
  // some frames still refuse, so keep the buttons harmless on failure.
  const navigateFrame = (action: (win: Window) => void) => {
    try {
      const win = iframeRef.current?.contentWindow;
      if (win) action(win);
    } catch {
      // no-op
    }
  };

  const domain = safeDomain(bookmark.url);
  // headerBlocked unmounts the iframe, so it wins over a stale load event
  // (browsers fire load even for refused frames).
  const blocked = headerBlocked || (timedOut && !loaded);

  return (
    <dialog
      open
      aria-modal={false}
      aria-label={`Preview of ${bookmark.title || domain}`}
      className={cn(
        // Mobile: fullscreen overlay. Desktop: in-flow flex child stretched to
        // the section height; the list scrolls in its own column, not this one.
        "fixed inset-0 z-50 m-0 flex h-dvh w-full flex-col border-0 bg-background p-0 outline-none md:static md:inset-auto md:z-auto md:h-auto md:w-[42%] md:max-w-140 md:shrink-0 md:border-l md:border-border/60",
        closing
          ? "animate-out fade-out slide-out-to-right-4 duration-150 ease-out"
          : "animate-in fade-in slide-in-from-right-4 duration-200 ease-out",
      )}
    >
      <div className="flex h-12 shrink-0 items-center gap-1 border-b border-border/60 px-2 md:px-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 px-1">
          <div className="flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-xs">
            {bookmark.favicon_url ? (
              // oxlint-disable-next-line next/no-img-element -- nothing to optimize
              <img
                src={bookmark.favicon_url}
                alt=""
                className="size-full object-contain"
              />
            ) : (
              <GlobeIcon className="size-full text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium leading-tight tracking-tight">
              {bookmark.title || domain}
            </p>
            <p className="truncate text-[11px] leading-tight text-muted-foreground">
              {domain}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5 text-muted-foreground">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => navigateFrame((win) => win.history.back())}
            aria-label="Back"
            title="Back"
          >
            <ArrowLeftIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => navigateFrame((win) => win.history.forward())}
            aria-label="Forward"
            title="Forward"
          >
            <ArrowRightIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => navigateFrame((win) => win.location.reload())}
            aria-label="Reload"
            title="Reload"
          >
            <ArrowClockwiseIcon />
          </Button>
        </div>

        <div aria-hidden className="mx-1 h-4 w-px shrink-0 bg-border/60" />

        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={openExternal}
            aria-label="Open in new tab"
            title="Open in new tab"
          >
            <ArrowSquareOutIcon />
          </Button>
          <Button
            ref={closeRef}
            variant="ghost"
            size="icon-sm"
            onClick={close}
            aria-label="Close preview"
            title="Close (Esc)"
          >
            <XIcon />
          </Button>
        </div>
      </div>

      <div className="relative flex-1 bg-muted/30">
        {!headerBlocked && (
          <iframe
            key={bookmark.id}
            ref={iframeRef}
            src={bookmark.url}
            title={`Preview of ${bookmark.title || domain}`}
            onLoad={() => {
              loadedRef.current = true;
              setLoaded(true);
            }}
            sandbox="allow-downloads allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
            referrerPolicy="no-referrer"
            className="absolute inset-0 size-full border-0 bg-white"
          />
        )}

        {!loaded && !blocked && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Orb
              size={24}
              label="Loading preview…"
              className="text-muted-foreground"
            />
          </div>
        )}

        {blocked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background p-6 text-center">
            <GlobeIcon className="size-8 text-muted-foreground/50" />
            <div>
              <p className="text-sm font-medium">
                This site can&apos;t be previewed here
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {domain} may block embedding. You can still open it in a new
                tab.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={openExternal}>Open in new tab</Button>
              {timedOut && !headerBlocked && (
                <Button variant="ghost" onClick={() => setTimedOut(false)}>
                  Keep waiting
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
