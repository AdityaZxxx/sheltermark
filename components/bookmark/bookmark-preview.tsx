"use client";

import type React from "react";

import {
  ArrowSquareOutIcon,
  ArrowsInSimpleIcon,
  ArrowsOutSimpleIcon,
  GlobeIcon,
  MoonIcon,
  SunIcon,
  TextAaIcon,
  TextBIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import type { Bookmark } from "~/lib/schemas/bookmark.schema";

import { checkEmbeddable } from "~/app/action/bookmark.action";
import { Button } from "~/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  cycleTextSize,
  parseStoredReaderPrefs,
  READER_DEFAULT,
  READER_KEY,
  type ReaderPrefs,
} from "~/lib/preview/reader-prefs";
import { resolvePreview, type PreviewKind } from "~/lib/preview/resolve";
import { safeDomain } from "~/lib/utils";
import { cn } from "~/lib/utils";

import { Orb } from "./orb";

// Sites that refuse embedding (X-Frame-Options / CSP) still fire load in some
// browsers, so this timeout is a heuristic — the fallback stays dismissible.
const LOAD_TIMEOUT_MS = 10_000;
const EXIT_MS = 150;

const DIRECT_SANDBOX =
  "allow-downloads allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts";
// Embeddable-provider players (ADR-0007 strategy 1): providers need scripts
// and same-origin inside their own frame to run the player UI; popups for
// related-video clicks out of the sandbox.
const EMBED_SANDBOX =
  "allow-popups allow-popups-to-escape-sandbox allow-presentation allow-scripts allow-same-origin";
// Extracted documents (ADR-0007) are our own sanitized HTML: no scripts, no
// same-origin, no forms. allow-popups stays so the sanitizer's forced
// target="_blank" links work — script-free frames can only open popups from a
// real user click, and rel="noopener noreferrer" blocks opener tricks.
const EXTRACTED_SANDBOX = "allow-popups allow-popups-to-escape-sandbox";
// Native proxy documents (ADR-0007) re-serve GitHub's DOM with every script
// stripped (verified Raindrop approach); CSS alone renders the native look,
// so scripts stay off — the strictest sandbox that still works.
const PROXY_SANDBOX = "allow-popups allow-popups-to-escape-sandbox";

function sandboxFor(kind: PreviewKind["kind"]): string {
  if (kind === "proxy") return PROXY_SANDBOX;
  if (kind === "server") return EXTRACTED_SANDBOX;
  if (kind === "embed") return EMBED_SANDBOX;
  return DIRECT_SANDBOX;
}

// Provider players (YouTube, Spotify, …) refuse to play without a referrer
// (YouTube serves "Error 153" under no-referrer). Their embed origins are
// hard-coded providers, so a referrer only ever leaks "which player is
// embedding me" — safe to send.
function referrerPolicyFor(
  kind: PreviewKind["kind"],
): React.HTMLAttributeReferrerPolicy {
  return kind === "embed" ? "strict-origin-when-cross-origin" : "no-referrer";
}

interface BookmarkPreviewProps {
  bookmark: Bookmark;
  onClose: () => void;
}

type PreviewMode = "original" | "reader";

export function BookmarkPreview({ bookmark, onClose }: BookmarkPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const loadedRef = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [closing, setClosing] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [reader, setReader] = useState<ReaderPrefs>(READER_DEFAULT);
  const [mode, setMode] = useState<PreviewMode>("original");
  const [betaDismissed, setBetaDismissed] = useState(false);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- canonical mounted guard: reader prefs live in localStorage, unknowable during SSR/render; hydrating post-mount prevents a server/client mismatch
    setReader(parseStoredReaderPrefs(window.localStorage.getItem(READER_KEY)));
  }, []);

  useEffect(() => {
    if (reader !== READER_DEFAULT) {
      window.localStorage.setItem(READER_KEY, JSON.stringify(reader));
    }
  }, [reader]);

  // ADR-0007 resolver: embed/server kinds resolve synchronously; iframe kinds
  // start optimistic and downgrade to the server extraction preview when the
  // embeddability probe says the origin refuses framing. Derivation happens in
  // render — only the probe result lands in state. The Reader tab overrides
  // the resolver's answer: it always renders the server-extracted document.
  const [downgraded, setDowngraded] = useState(false);
  const base = resolvePreview(bookmark);
  const serverSrc = (u: string) =>
    `/api/preview?url=${encodeURIComponent(u)}&theme=${reader.theme}&font=${reader.font}&size=${reader.size}`;
  const resolved: PreviewKind =
    mode === "reader" || downgraded || base.kind === "server"
      ? { kind: "server", src: serverSrc(bookmark.url) }
      : base;

  // Load gate: runs per rendered document (mode switches remount the frame
  // via the src key), so timeout state resets on every tab change.
  useEffect(() => {
    loadedRef.current = false;
    setLoaded(false);
    setTimedOut(false);
    const timer = setTimeout(() => {
      if (!loadedRef.current) setTimedOut(true);
    }, LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resets load state whenever the rendered document changes
  }, [resolved.src]);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, []);

  // Direct-iframe gate (strategy 2): probe embeddable-unknown origins and
  // downgrade to the server preview when the origin refuses framing. The
  // component remounts per bookmark (keyed), so boolean state is safe.
  useEffect(() => {
    if (base.kind !== "iframe") return;
    let cancelled = false;
    checkEmbeddable({ url: bookmark.url }).then((res) => {
      if (!cancelled && res.success && res.data.embeddable === false) {
        setDowngraded(true);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remounted per bookmark; base derives from bookmark.url alone
  }, [bookmark.url]);

  const close = () => {
    setClosing(true);
    setTimeout(onClose, EXIT_MS);
  };

  const openExternal = () => {
    window.open(bookmark.url, "_blank", "noopener,noreferrer");
  };

  // When maximized, Esc exits fullscreen first (capture: the list manager's
  // own Esc handler closes the whole preview and would win otherwise).
  useEffect(() => {
    if (!maximized) return;
    const exitFullscreen = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setMaximized(false);
      }
    };
    window.addEventListener("keydown", exitFullscreen, { capture: true });
    return () =>
      window.removeEventListener("keydown", exitFullscreen, { capture: true });
  }, [maximized]);

  const domain = safeDomain(bookmark.url);
  // If the extraction route (or the direct iframe) never signals load, give up
  // and offer the fallback.
  const blocked = timedOut && !loaded;

  return (
    <dialog
      open
      aria-modal={false}
      aria-label={`Preview of ${bookmark.title || domain}`}
      className={cn(
        // Mobile: fullscreen overlay. Desktop: in-flow flex child stretched to
        // the section height; the list scrolls in its own column, not this one.
        // Inside a ResizablePanel the panel dictates width, so fill the parent.
        // Maximized: fullscreen overlay at every breakpoint.
        "fixed inset-0 z-50 m-0 flex h-dvh w-full flex-col border-0 bg-background p-0 outline-none md:static md:inset-auto md:z-auto md:h-full md:w-full md:max-w-none md:border-0",
        maximized && "fixed inset-0 z-50 h-dvh max-w-none border-0",
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

        <Tabs
          value={mode}
          onValueChange={(v) => {
            // SAFETY: both TabsTrigger values map 1:1 to PreviewMode; the
            // cast only re-narrows the string union BaseUI hands back.
            setMode(v as PreviewMode);
          }}
          className="shrink-0"
        >
          <TabsList className="h-7">
            <TabsTrigger value="reader">Reader</TabsTrigger>
            <TabsTrigger value="original">Original</TabsTrigger>
          </TabsList>
        </Tabs>

        {mode === "reader" && (
          <div className="flex shrink-0 items-center gap-0.5 text-muted-foreground">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() =>
                setReader((r) => ({ ...r, size: cycleTextSize(r.size) }))
              }
              aria-label="Cycle text size"
              title="Text size"
            >
              <TextAaIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() =>
                setReader((r) => ({
                  ...r,
                  font: r.font === "sans" ? "serif" : "sans",
                }))
              }
              aria-label="Toggle font family"
              title={
                reader.font === "sans"
                  ? "Switch to serif"
                  : "Switch to sans-serif"
              }
            >
              <TextBIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() =>
                setReader((r) => ({
                  ...r,
                  theme: r.theme === "light" ? "dark" : "light",
                }))
              }
              aria-label="Toggle reader theme"
              title={reader.theme === "light" ? "Dark reader" : "Light reader"}
            >
              {reader.theme === "light" ? <MoonIcon /> : <SunIcon />}
            </Button>
          </div>
        )}

        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setMaximized((m) => !m)}
            aria-label={maximized ? "Exit fullscreen" : "Fullscreen"}
            title={maximized ? "Exit fullscreen (Esc)" : "Fullscreen"}
            className="hidden md:inline-flex"
          >
            {maximized ? <ArrowsInSimpleIcon /> : <ArrowsOutSimpleIcon />}
          </Button>
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

      {mode === "reader" && !betaDismissed && (
        <div className="flex shrink-0 items-center justify-center gap-2 border-b border-border/60 bg-muted/60 px-3 py-1.5 text-[11px] text-muted-foreground">
          <span>
            Reader is still new — some pages may not come through quite right.
          </span>
          <a
            href="mailto:adityaofficial714@gmail.com"
            className="shrink-0 font-medium text-foreground underline underline-offset-2 hover:text-muted-foreground"
          >
            Send feedback
          </a>
          <button
            type="button"
            onClick={() => setBetaDismissed(true)}
            aria-label="Dismiss notice"
            className="shrink-0 rounded-xs p-0.5 hover:bg-foreground/10"
          >
            <XIcon className="size-3" />
          </button>
        </div>
      )}

      <div className="relative flex-1 bg-muted/30">
        <iframe
          key={`${bookmark.id}-${resolved.src}`}
          ref={iframeRef}
          src={resolved.src}
          title={`Preview of ${bookmark.title || domain}`}
          onLoad={() => {
            loadedRef.current = true;
            setLoaded(true);
          }}
          sandbox={sandboxFor(resolved.kind)}
          referrerPolicy={referrerPolicyFor(resolved.kind)}
          className="absolute inset-0 size-full border-0 bg-white"
        />

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
              <Button variant="ghost" onClick={() => setTimedOut(false)}>
                Try again
              </Button>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
