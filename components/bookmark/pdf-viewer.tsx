"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "~/components/ui/button";

import { Orb } from "./orb";

// Inline PDF viewer (ADR-0007). pdf.js renders the proxied document into a
// canvas inside our own panel — consistent chrome, keyboard scrolling, no
// third-party frame. The worker is vendored at /vendor (see
// tests/unit/pdf-worker-drift.test.ts) so no runtime CDN dependency.
// ponytail: single-page-at-a-time canvas rendering with fit-to-width
// scaling, prev/next controls, and no text layer. If text
// selection/search complaints arrive, add pdf.js RenderTextLayer before
// swapping in a heavier wrapper.

// pdf.js fetch failures: the proxy's 415 (URL guessed media, origin served
// HTML) surfaces from pdf.js as UnexpectedResponseException — the one failure
// that means "route this URL through the normal chain instead".
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- third-party exception (pdf.js UnexpectedResponseException is unexported in types); name-based Error narrowing is the only boundary check available
function isWrongGuess(err: unknown): boolean {
  return err instanceof Error && err.name === "UnexpectedResponseException";
}

interface PdfViewerProps {
  src: string;
  // The panel passes this so a wrong URL guess (extension said .pdf, origin
  // served HTML → proxy 415, or upstream died) can fall back to the normal
  // iframe/extraction path instead of a dead end.
  onUnavailable?: () => void;
}

// Rendered page width = container width, clamped so a page never renders
// absurdly tiny or absurdly huge.
const MIN_SCALE = 0.3;
const MAX_SCALE = 3;
const ZOOM_STEP = 1.2;

export function PdfViewer({ src, onUnavailable }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const docRef = useRef<unknown>(null);
  const renderTaskRef = useRef<PdfRenderTask | null>(null);
  // User zoom state: null = fit-to-width (auto), a number = explicit scale
  // the user picked. Once explicit, panel resizes keep the scale (the user
  // owns zoom) — only "Fit" returns to auto. Independent of the page/app
  // zoom by design (Raindrop parity).
  const [userScale, setUserScale] = useState<number | null>(null);
  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "error"; message: string }
    | { phase: "ready"; page: number; total: number; scale: number }
  >({ phase: "loading" });

  // Fit-to-container width, clamped. The container is the scrollable div,
  // so the canvas width equals its client width (padding-free) — a re-render
  // on panel resize comes free via the ResizeObserver below.
  const fitScale = (page: PdfPage): number => {
    const container = containerRef.current;
    if (!container) return 1;
    const available = container.clientWidth;
    if (available <= 0) return 1;
    return Math.min(
      MAX_SCALE,
      Math.max(MIN_SCALE, available / page.getViewport({ scale: 1 }).width),
    );
  };

  // Render function lives in a ref so the effect never re-runs for page
  // changes (page state lives in `state`, not deps). Cancels any in-flight
  // render first — pdf.js forbids two renders on one canvas, and a resize
  // burst or fast page-click otherwise stacks them. Scale is always passed
  // explicitly ("fit" or a number) so no caller depends on a stale
  // userScale closure.
  const renderPage = async (pageNum: number, scale: number | "fit") => {
    const doc = docRef.current;
    if (!doc) return;
    // SAFETY: docRef is only ever assigned a loaded pdf.js document (types
    // arrive via dynamic import below); the narrow calls mirror pdf.js's API.
    const d = doc as {
      numPages: number;
      getPage: (n: number) => Promise<PdfPage>;
    };
    renderTaskRef.current?.cancel();
    const page = await d.getPage(pageNum);
    const resolvedScale = scale === "fit" ? fitScale(page) : scale;
    const viewport = page.getViewport({ scale: resolvedScale });
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    const task = page.render({ canvas, viewport });
    renderTaskRef.current = task;
    try {
      await task.promise;
    } catch {
      // RenderingException — the previous task was cancelled. Expected on
      // resize bursts and rapid page flips; the last task wins.
      return;
    }
    setState({
      phase: "ready",
      page: pageNum,
      total: d.numPages,
      scale: resolvedScale,
    });
  };

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    (async () => {
      // Dynamic import: pdfjs is only needed when a PDF is actually opened,
      // keeping it out of the panel's initial bundle. Cmaps + standard fonts
      // are vendored for CJK/legacy PDF rendering (pdf.js v5 ships no
      // defaults).
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
      const task = pdfjs.getDocument({
        url: src,
        cMapUrl: "/vendor/pdf-cmaps/",
        cMapPacked: true,
        standardFontDataUrl: "/vendor/pdf-standard-fonts/",
      });
      const doc = await task.promise;
      if (cancelled) return;
      docRef.current = doc;
      await renderPage(1, userScaleRef.current ?? "fit");
      // oxlint-disable-next-line anti-slop/no-unknown-parameters -- parse delegated to isWrongGuess (Error-name narrowing of pdf.js's unexported exception type)
    })().catch((err: unknown) => {
      if (cancelled) return;
      // Our proxy's 415 (URL guessed media, origin served HTML) surfaces
      // from pdf.js as UnexpectedResponseException — hand the URL back to
      // the panel's normal iframe/extraction chain instead of a dead end.
      if (isWrongGuess(err)) {
        onUnavailable?.();
        return;
      }
      setState({
        phase: "error",
        message: "This PDF couldn't be displayed inline.",
      });
    });

    return () => {
      cancelled = true;
      const doc = docRef.current;
      if (doc) {
        // SAFETY: same-shape narrow as renderPage; destroy() is pdf.js's
        // documented cleanup for a loaded document.
        (doc as { destroy: () => Promise<void> }).destroy().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remounts per src; renderPage is ref-stable
  }, [src]);

  const userScaleRef = useRef<number | null>(null);
  userScaleRef.current = userScale;

  // Re-render on container resize — split pane drag, window resize,
  // fullscreen toggle. In fit mode this re-fits to the new width; with an
  // explicit user zoom the scale is kept (the user owns zoom). Debounced by
  // rAF so a drag doesn't queue a render per pixel.
  useEffect(() => {
    if (state.phase !== "ready") return;
    const container = containerRef.current;
    if (!container) return;
    let raf = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (state.phase === "ready")
          renderPage(state.page, userScaleRef.current ?? "fit");
      });
    });
    observer.observe(container);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- state.page captured per-ready-phase; renderPage is ref-stable
  }, [state.phase, state.phase === "ready" ? state.page : 0]);

  // Keyboard: arrows/PgUp/PgDn/Space scroll natively on the focused
  // container; Home/End jump pages. Ctrl +/- zooms, Ctrl+0 returns to fit —
  // scoped to this viewer's focus, never the page-level browser zoom.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (state.phase !== "ready") return;
    const container = containerRef.current;
    if (!container) return;
    if (e.ctrlKey || e.metaKey) {
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomBy(ZOOM_STEP);
      } else if (e.key === "-") {
        e.preventDefault();
        zoomBy(1 / ZOOM_STEP);
      } else if (e.key === "0") {
        e.preventDefault();
        setUserScale(null);
        renderPage(state.page, "fit");
      }
      return;
    }
    const intent = userScaleRef.current ?? "fit";
    if (e.key === "Home") {
      e.preventDefault();
      renderPage(1, intent);
    } else if (e.key === "End") {
      e.preventDefault();
      renderPage(state.total, intent);
    }
    // ArrowUp/Down/PgUp/PgDn/Space fall through to the browser's native
    // scroll of the focused container.
  };

  const zoomBy = (factor: number) => {
    if (state.phase !== "ready") return;
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, state.scale * factor));
    setUserScale(next);
    renderPage(state.page, next);
  };

  if (state.phase === "error") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm font-medium">Preview unavailable</p>
        <p className="text-xs text-muted-foreground">{state.message}</p>
        <Button variant="outline" onClick={() => window.open(src, "_blank")}>
          Open in new tab
        </Button>
      </div>
    );
  }

  const pct = Math.round(state.phase === "ready" ? state.scale * 100 : 100);

  return (
    <div className="flex h-full flex-col bg-muted/30">
      <div className="flex shrink-0 items-center justify-center gap-2 border-b border-border/60 py-1.5">
        {state.phase === "ready" && (
          <>
            <Button
              variant="ghost"
              size="sm"
              disabled={state.page <= 1}
              onClick={() =>
                renderPage(state.page - 1, userScaleRef.current ?? "fit")
              }
              aria-label="Previous page"
            >
              ←
            </Button>
            <span className="text-xs tabular-nums text-muted-foreground">
              {state.page} / {state.total}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={state.page >= state.total}
              onClick={() =>
                renderPage(state.page + 1, userScaleRef.current ?? "fit")
              }
              aria-label="Next page"
            >
              →
            </Button>
            <div className="ml-2 flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={state.scale <= MIN_SCALE}
                onClick={() => zoomBy(1 / ZOOM_STEP)}
                aria-label="Zoom out"
                title="Zoom out (Ctrl−)"
              >
                −
              </Button>
              <span className="w-9 text-center text-[11px] tabular-nums text-muted-foreground/70">
                {pct}%
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={state.scale >= MAX_SCALE}
                onClick={() => zoomBy(ZOOM_STEP)}
                aria-label="Zoom in"
                title="Zoom in (Ctrl+)"
              >
                +
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={userScale === null}
                onClick={() => {
                  setUserScale(null);
                  renderPage(state.page, "fit");
                }}
                aria-label="Fit width"
                title="Fit width (Ctrl+0)"
                className="px-1.5 text-[11px]"
              >
                Fit
              </Button>
            </div>
          </>
        )}
      </div>
      <div
        ref={containerRef}
        role="document"
        aria-label="PDF document"
        onKeyDown={onKeyDown}
        tabIndex={0}
        className="relative flex-1 overflow-auto outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <canvas ref={canvasRef} className="mx-auto block" />
        {state.phase !== "ready" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Orb
              size={24}
              label="Loading PDF…"
              className="text-muted-foreground"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Structural subset of pdf.js types used above — the real types come from the
// dynamic import; these describe the calls we make on the page/document.
// (pdf.js v5 render() takes `canvas`, not `canvasContext`.)
interface PdfRenderTask {
  promise: Promise<void>;
  cancel: () => void;
}
interface PdfPage {
  getViewport: (o: { scale: number }) => { width: number; height: number };
  render: (o: {
    canvas: HTMLCanvasElement;
    viewport: { width: number; height: number };
  }) => PdfRenderTask;
}
