"use client";

import type React from "react";

import {
  ArrowClockwiseIcon,
  ArrowSquareOutIcon,
  ArrowsInSimpleIcon,
  ArrowsOutSimpleIcon,
  CaretDownIcon,
  CaretUpIcon,
  GlobeIcon,
  InfoIcon,
  TextAaIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import type { Bookmark } from "~/lib/schemas/bookmark.schema";

import { checkEmbeddable } from "~/app/action/bookmark.action";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { classifyUrl } from "~/lib/preview/classify";
import {
  parseStoredReaderPrefs,
  READER_BETA_KEY,
  READER_DEFAULT,
  READER_KEY,
  type PreviewMode,
  type ReaderPrefs,
} from "~/lib/preview/reader-prefs";
import {
  effectivePreview,
  resolvePreview,
  type PreviewKind,
} from "~/lib/preview/resolve";
import { safeDomain } from "~/lib/utils";
import { cn } from "~/lib/utils";

import { Orb } from "./orb";
import { PdfViewer } from "./pdf-viewer";
import { PreviewStage } from "./preview-stage";
import { ReadableDocument } from "./readable-document";

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
  nav: PreviewNav;
  mode: PreviewMode;
  onModeChange: (mode: PreviewMode) => void;
}

interface PreviewNav {
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

export function BookmarkPreview({
  bookmark,
  onClose,
  nav,
  mode,
  onModeChange,
}: BookmarkPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const loadedRef = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [closing, setClosing] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [reader, setReader] = useState<ReaderPrefs>(READER_DEFAULT);
  const [betaOpen, setBetaOpen] = useState(false);

  // One-time hint: auto-open on first reader use; any close marks it seen.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- canonical mounted guard: localStorage is unknowable during SSR/render; hydrating post-mount prevents a server/client mismatch
    if (mode === "reader" && !window.localStorage.getItem(READER_BETA_KEY)) {
      setBetaOpen(true);
    }
  }, [mode]);

  const handleBetaOpenChange = (open: boolean) => {
    setBetaOpen(open);
    if (!open) window.localStorage.setItem(READER_BETA_KEY, "1");
  };

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
  // start optimistic and are refined by the embeddability probe — a framing
  // refusal downgrades to server extraction, and a non-HTML Content-Type
  // (PDF/image/media) routes to the matching viewer (classify.ts). A
  // confident URL guess (explicit .pdf, arXiv /pdf/<id>) skips the probe
  // entirely — Raindrop-style instant media routing; the media proxy
  // re-verifies Content-Type server-side anyway. The Reader tab overrides
  // the resolver's answer: it always renders the server-extracted document.
  const [downgraded, setDowngraded] = useState(false);
  const [probe, setProbe] = useState<{
    embeddable: boolean;
    contentType: string | null;
  } | null>(null);
  // Set when a confident URL media guess turned out wrong (viewer hit the
  // proxy's 415) — re-enters the probe path and stops the instant routing.
  const [guessWrong, setGuessWrong] = useState(false);
  const base = resolvePreview(bookmark);
  const urlGuess = guessWrong ? null : classifyUrl(bookmark.url);
  const [previewNonce, setPreviewNonce] = useState(0);
  const refreshPreview = () => setPreviewNonce((n) => n + 1);
  const serverSrc = (u: string) =>
    `/api/preview?${previewNonce ? "refresh=1&" : ""}url=${encodeURIComponent(u)}&theme=${reader.theme}&font=${reader.font}&size=${reader.size}`;
  // Media classification wins over the framing downgrade: a PDF/image/media
  // Content-Type (from the probe or a confident URL guess) routes to the
  // media viewer even when the origin also refuses framing — extracting
  // HTML from binary bytes can never succeed (resolve.ts's contract).
  const media: PreviewKind = effectivePreview(
    bookmark,
    urlGuess ? null : probe,
  );
  const resolved: PreviewKind =
    mode === "reader" || base.kind === "server"
      ? { kind: "server", src: serverSrc(bookmark.url) }
      : media.kind !== "iframe"
        ? media
        : downgraded
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
  // probe's Content-Type also feeds effectivePreview's media classification.
  // Skipped when the URL itself is confident media (classifyUrl) — but a
  // viewer that reports the guess wrong (onUnavailable) re-enters the probe
  // path here. The component remounts per bookmark (keyed), so boolean
  // state is safe.
  useEffect(() => {
    if (base.kind !== "iframe" || urlGuess) return;
    let cancelled = false;
    checkEmbeddable({ url: bookmark.url }).then((res) => {
      if (!cancelled && res.success) {
        setProbe(res.data);
        if (res.data.embeddable === false) {
          setDowngraded(true);
        }
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
  // Overlays track the iframe load gate, which exists only when a frame
  // mounts. Reader mode renders natively, so without this the orb — then
  // the blocked fallback — would paint over rendered content.
  const frameOverlays =
    resolved.kind === "iframe" ||
    (resolved.kind === "server" && mode !== "reader");

  return (
    <dialog
      open
      aria-modal={false}
      aria-label={`Preview of ${bookmark.title || domain}`}
      data-sheltermark-preview=""
      className={cn(
        // Mobile: fullscreen overlay. Desktop: in-flow flex child stretched to
        // the section height; the list scrolls in its own column, not this one.
        // Inside a ResizablePanel the panel dictates width, so fill the parent.
        // Maximized: fullscreen overlay at every breakpoint — mutually
        // exclusive with the desktop in-flow classes, because Tailwind's
        // md:* variants would otherwise override a plain `fixed` in the
        // stylesheet order no matter how the strings are concatenated.
        "m-0 flex w-full flex-col border-0 bg-background p-0 outline-none",
        maximized
          ? "fixed inset-0 z-50 h-dvh max-w-none"
          : "fixed inset-0 z-50 h-dvh md:static md:inset-auto md:z-auto md:h-full md:w-full md:max-w-none md:border-0",
        // No entry animation: the dialog remounts per bookmark (keyed), so
        // a slide-in would replay on every prev/next step. The exit
        // animation runs once on close via the closing flag.
        closing &&
          "animate-out fade-out slide-out-to-right-4 duration-150 ease-out",
      )}
    >
      <div className="flex h-12 shrink-0 items-center justify-between gap-1 border-b border-border/60 px-2 md:px-3">
        <div className="flex min-w-0 items-center gap-1">
          <Tabs
            value={mode}
            onValueChange={(v) => {
              // SAFETY: both TabsTrigger values map 1:1 to PreviewMode; the
              // cast only re-narrows the string union BaseUI hands back.
              onModeChange(v as PreviewMode);
            }}
            className="shrink-0"
          >
            <TabsList className="h-8">
              <TabsTrigger value="reader">Reader</TabsTrigger>
              <TabsTrigger value="original">Original</TabsTrigger>
            </TabsList>
          </Tabs>

          {mode === "reader" && (
            <>
              <Popover>
                <PopoverTrigger
                  aria-label="Reader options"
                  title="Reader options"
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <TextAaIcon className="size-4" aria-hidden="true" />
                </PopoverTrigger>
                <PopoverContent align="end" className="w-56 p-2">
                  <div className="flex flex-col gap-1 p-1">
                    <div className="flex items-center gap-2">
                      <p className="w-12 shrink-0 text-xs text-muted-foreground">
                        Size
                      </p>
                      <Tabs
                        value={reader.size}
                        onValueChange={(v) => {
                          if (v === "sm" || v === "md" || v === "lg") {
                            setReader((r) => ({ ...r, size: v }));
                          }
                        }}
                        className="min-w-0 flex-1"
                      >
                        <TabsList className="grid w-full grid-cols-3 bg-muted/60">
                          <TabsTrigger value="sm" aria-label="Text size: Small">
                            <span className="text-[11px]">A</span>
                          </TabsTrigger>
                          <TabsTrigger
                            value="md"
                            aria-label="Text size: Medium"
                          >
                            <span className="text-sm">A</span>
                          </TabsTrigger>
                          <TabsTrigger value="lg" aria-label="Text size: Large">
                            <span className="text-base">A</span>
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="w-12 shrink-0 text-xs text-muted-foreground">
                        Font
                      </p>
                      <Tabs
                        value={reader.font}
                        onValueChange={(v) => {
                          if (v === "sans" || v === "serif") {
                            setReader((r) => ({ ...r, font: v }));
                          }
                        }}
                        className="min-w-0 flex-1"
                      >
                        <TabsList className="grid w-full grid-cols-2 bg-muted/60">
                          <TabsTrigger value="sans" aria-label="Font: Sans">
                            <span className="font-sans">Ag</span>
                          </TabsTrigger>
                          <TabsTrigger value="serif" aria-label="Font: Serif">
                            <span className="font-serif">Ag</span>
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="w-12 shrink-0 text-xs text-muted-foreground">
                        Theme
                      </p>
                      <Tabs
                        value={reader.theme}
                        onValueChange={(v) => {
                          if (v === "light" || v === "dark") {
                            setReader((r) => ({ ...r, theme: v }));
                          }
                        }}
                        className="min-w-0 flex-1"
                      >
                        <TabsList className="grid w-full grid-cols-2 bg-muted/60">
                          <TabsTrigger value="light" aria-label="Theme: Light">
                            <span
                              aria-hidden="true"
                              className="size-3 rounded-full border"
                              style={{
                                backgroundColor: "#ffffff",
                                borderColor: "rgba(127,127,127,0.4)",
                              }}
                            />
                            Light
                          </TabsTrigger>
                          <TabsTrigger value="dark" aria-label="Theme: Dark">
                            <span
                              aria-hidden="true"
                              className="size-3 rounded-full border"
                              style={{
                                backgroundColor: "#141518",
                                borderColor: "rgba(255,255,255,0.25)",
                              }}
                            />
                            Dark
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <Popover open={betaOpen} onOpenChange={handleBetaOpenChange}>
                <PopoverTrigger
                  aria-label="About the reader"
                  title="About the reader"
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <InfoIcon className="size-4" aria-hidden="true" />
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64">
                  <p className="text-xs text-muted-foreground">
                    Reader is still new — some pages may not come through quite
                    right.{" "}
                    <a
                      href="mailto:adityaofficial714@gmail.com"
                      className="font-medium text-foreground underline underline-offset-2 hover:text-muted-foreground"
                    >
                      Send feedback
                    </a>
                  </p>
                </PopoverContent>
              </Popover>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={nav.onPrev}
            disabled={!nav.hasPrev}
            aria-label="Previous bookmark"
            title="Previous bookmark"
          >
            <CaretUpIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={nav.onNext}
            disabled={!nav.hasNext}
            aria-label="Next bookmark"
            title="Next bookmark"
          >
            <CaretDownIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={refreshPreview}
            aria-label="Refresh preview"
            title="Refresh preview (re-extracts this page)"
          >
            <ArrowClockwiseIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMaximized((m) => !m)}
            aria-label={maximized ? "Exit fullscreen" : "Fullscreen"}
            title={maximized ? "Exit fullscreen (Esc)" : "Fullscreen"}
            className="hidden md:inline-flex"
          >
            {maximized ? <ArrowsInSimpleIcon /> : <ArrowsOutSimpleIcon />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={openExternal}
            aria-label="Open in new tab"
            title="Open in new tab"
          >
            <ArrowSquareOutIcon />
          </Button>
          <Button
            ref={closeRef}
            variant="ghost"
            size="icon"
            onClick={close}
            aria-label="Close preview"
            title="Close (Esc)"
          >
            <XIcon />
          </Button>
        </div>
      </div>

      <PreviewStage>
        {resolved.kind === "pdf" ? (
          <PdfViewer
            src={resolved.src}
            onUnavailable={() => setGuessWrong(true)}
          />
        ) : resolved.kind === "server" && mode === "reader" ? (
          // Phase 2: native readable-document render — same extraction, same
          // sanitizer, rendered as React DOM instead of a sandboxed iframe.
          <ReadableDocument
            url={bookmark.url}
            source={{
              title: bookmark.title || domain,
              domain,
              faviconUrl: bookmark.favicon_url,
            }}
            api={`/api/preview?format=json&${previewNonce ? "refresh=1&" : ""}url=${encodeURIComponent(bookmark.url)}`}
            theme={reader.theme}
            font={reader.font}
            size={reader.size}
          />
        ) : resolved.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote images, no optimization possible
          <img
            src={resolved.src}
            alt={bookmark.title ?? domain}
            className="absolute inset-0 m-auto max-h-full max-w-full object-contain p-4"
            referrerPolicy="no-referrer"
          />
        ) : resolved.kind === "video" ? (
          // oxlint-disable-next-line jsx-a11y/media-has-caption -- arbitrary bookmarked videos; we can't source caption tracks for third-party media
          <video
            src={resolved.src}
            controls
            preload="metadata"
            className="absolute inset-0 m-auto max-h-full max-w-full p-4"
          />
        ) : resolved.kind === "audio" ? (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- arbitrary bookmarked audio; no caption tracks exist */}
            <audio src={resolved.src} controls preload="metadata" />
          </div>
        ) : (
          // server-extract (non-reader) and generic iframe share one frame:
          // both render our-or-their HTML with the kind's sandbox.
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
            className="absolute inset-0 size-full border-0 bg-background"
          />
        )}

        {/* Loading/blocked overlays only make sense for iframe-rendered
            kinds — native viewers handle their own states. */}
        {frameOverlays && !loaded && !blocked && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Orb
              size={24}
              label="Loading preview…"
              className="text-muted-foreground"
            />
          </div>
        )}

        {frameOverlays && blocked && (
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
      </PreviewStage>
    </dialog>
  );
}
