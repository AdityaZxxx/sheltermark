"use client";

import type React from "react";

import { GlobeIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import type { ReaderPrefs } from "~/lib/preview/reader-prefs";
import type { PreviewDoc } from "~/lib/schemas/preview.schema";

import {
  readerFontFamily,
  readerPalette,
  readerSizes,
} from "~/lib/preview/reader-palette";
import { previewDocSchema } from "~/lib/schemas/preview.schema";

import { Orb } from "./orb";

// Native readable-document renderer (ADR-0007 phase 2): fetches the
// structured JSON from /api/preview?format=json and renders the sanitized
// article HTML as React DOM instead of a sandboxed iframe. The HTML is the
// same sanitizer output the iframe path serves (allowlist tags, no scripts,
// forced noopener links), so rendering it in-app is equally safe — and it
// gets native scrolling, text selection, and theme integration for free.
// ponytail: dangerouslySetInnerHTML over a markdown/block AST rewrite —
// the sanitizer is the security boundary and re-parsing into blocks would
// be a second, worse parser. Revisit only if per-block features appear.

interface ReadableSource {
  title: string;
  domain: string;
  faviconUrl?: string | null;
}

interface ReadableDocumentProps {
  url: string;
  source: ReadableSource;
  api: string;
  // Reader appearance (ADR-0007): the native render honors the same prefs
  // the iframe path receives as query params.
  theme: ReaderPrefs["theme"];
  font: ReaderPrefs["font"];
  size: ReaderPrefs["size"];
}

// Boundary parse (repo rule: Zod at the I/O edge) — malformed payloads and
// missing optional fields resolve to a failed/nullable doc, never a crash.
async function fetchDoc(api: string): Promise<PreviewDoc> {
  const res = await fetch(api, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`preview api ${res.status}`);
  return previewDocSchema.parse(await res.json());
}

// React's CSSProperties types only the standard properties; CSS custom
// properties ride along under this index-signature intersection.
type ReaderStyle = React.CSSProperties &
  Record<`--${string}`, string | undefined>;

// Reader styling for the native render — mirrors the iframe reader CSS
// (route.ts readerCss) as a React style object so theme/font/size render
// identically in both paths.
function readerStyle(p: {
  theme: ReaderPrefs["theme"];
  font: ReaderPrefs["font"];
  size: ReaderPrefs["size"];
}): ReaderStyle {
  const pal = readerPalette(p.theme);
  const { base: baseSize, h1: h1Size } = readerSizes(p.size);
  return {
    colorScheme: p.theme,
    background: pal.bg,
    color: pal.fg,
    fontFamily: readerFontFamily(p.font),
    fontSize: baseSize,
    lineHeight: 1.7,
    // Consumed by the article's Tailwind arbitrary-value classes
    // ([&_a]:text-[var(--link)] etc.) — fixed literals only.
    "--muted": pal.muted,
    "--quote": pal.quote,
    "--pre-bg": pal.preBg,
    "--link": pal.link,
    "--h1-size": h1Size,
  } satisfies ReaderStyle;
}

type DocState =
  | { phase: "loading" }
  | { phase: "failed" }
  | { phase: "done"; doc: PreviewDoc };

function normTitle(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*[|–—:»-]\s*[^|–—:»-]+$/, "");
}

export function ReadableDocument({
  url,
  source,
  api,
  theme,
  font,
  size,
}: ReadableDocumentProps) {
  // Lazy init via promise: starts fetching on first render, no setState
  // inside an effect (oxlint set-state-in-effect).
  const [state, setState] = useState<DocState>(() => {
    void fetchDoc(api)
      .then((doc) => setState({ phase: "done", doc }))
      .catch(() => setState({ phase: "failed" }));
    return { phase: "loading" };
  });

  // Re-fetch when the api URL (bookmark) changes without remounting.
  useEffect(() => {
    if (state.phase === "loading") return;
    let cancelled = false;
    void fetchDoc(api)
      .then((doc) => {
        if (!cancelled) setState({ phase: "done", doc });
      })
      .catch(() => {
        if (!cancelled) setState({ phase: "failed" });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- api change alone re-fetches
  }, [api]);

  if (state.phase === "failed" || (state.phase === "done" && !state.doc.ok)) {
    return <FallbackDoc url={url} />;
  }

  if (state.phase === "loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <Orb
          size={24}
          label="Loading article…"
          className="text-muted-foreground"
        />
      </div>
    );
  }

  const doc = state.doc;

  const meta = [
    doc.byline,
    doc.siteName,
    doc.publishedTime ? new Date(doc.publishedTime).toLocaleDateString() : null,
  ].filter(Boolean);

  // Collapse the source title when it duplicates the extracted h1; compare
  // loosely so site suffixes ("Title – Site") don't count as a difference.
  const showSourceTitle =
    !doc.title.trim() || normTitle(doc.title) !== normTitle(source.title);

  return (
    <div
      className="h-full min-h-0 overflow-auto overscroll-contain"
      style={readerStyle({ theme, font, size })}
    >
      <div className="mx-auto max-w-2xl px-6 pt-6">
        <div className="flex items-center gap-1.5">
          <div className="flex size-3.5 shrink-0 items-center justify-center overflow-hidden rounded-xs">
            {source.faviconUrl ? (
              // oxlint-disable-next-line next/no-img-element -- nothing to optimize
              <img
                src={source.faviconUrl}
                alt=""
                className="size-full object-contain"
              />
            ) : (
              <GlobeIcon className="size-full text-[var(--muted)]" />
            )}
          </div>
          <p className="truncate text-xs text-[var(--muted)]">
            {source.domain}
          </p>
        </div>
        {showSourceTitle && (
          <p className="mt-1 truncate text-base font-semibold tracking-tight">
            {source.title}
          </p>
        )}
      </div>
      <article
        // Reader typography — the same stylesheet the iframe path serves
        // (route.ts readerCss), via the CSS vars set on the wrapper above.
        className="reader-doc mx-auto max-w-2xl px-6 pb-6 pt-3 [&_a]:underline [&_a]:underline-offset-2 [&_a]:text-[var(--link)] [&_blockquote]:border-l [&_blockquote]:border-[var(--quote)] [&_blockquote]:pl-4 [&_blockquote]:text-[var(--muted)] [&_code]:font-mono [&_code]:text-[0.9em] [&_figure]:my-6 [&_h1]:mb-3 [&_h1]:text-[length:var(--h1-size)] [&_h1]:font-semibold [&_h1]:tracking-tight [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold [&_hr]:my-8 [&_hr]:border-[var(--quote)] [&_img]:my-6 [&_img]:rounded-md [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-4 [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-[var(--pre-bg)] [&_pre]:p-3 [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-[var(--quote)] [&_td]:p-2 [&_th]:border [&_th]:border-[var(--quote)] [&_th]:p-2 [&_ul]:list-disc [&_ul]:pl-6"
        aria-label={doc.title}
      >
        {doc.title.trim() !== "" && (
          <h1 className="mb-1 text-2xl font-semibold tracking-tight">
            {doc.title}
          </h1>
        )}
        {meta.length > 0 && (
          <p className="text-sm text-muted-foreground">{meta.join(" · ")}</p>
        )}
        {doc.html && <div dangerouslySetInnerHTML={{ __html: doc.html }} />}
      </article>
    </div>
  );
}

function FallbackDoc({ url }: { url: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-sm font-medium">Preview unavailable</p>
      <p className="max-w-sm text-xs text-muted-foreground">
        This page couldn&apos;t be extracted for inline preview.
      </p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-medium text-primary underline underline-offset-2"
      >
        Open in new tab
      </a>
    </div>
  );
}
