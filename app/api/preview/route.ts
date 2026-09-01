import type { NextRequest } from "next/server";

import type { ExtractionResult } from "~/lib/extract/types";
import type { CacheDocument } from "~/lib/preview/cache";

import { requireAuthSafe } from "~/lib/auth";
import { extractContent } from "~/lib/extract/extract-content";
import {
  evictCached,
  revalidateInBackground,
  readCached,
  writeCached,
} from "~/lib/preview/cache";
import {
  readerPrefsSchema,
  type ReaderPrefs,
} from "~/lib/preview/reader-prefs";
import { logger } from "~/lib/utils/logger";

// Reader appearance (ADR-0007 reader parity with Raindrop): the panel sends
// its prefs as query params; the cached HTML is theme-independent so all
// variants reuse one cache row. Unknown values fall back to defaults.
const queryReaderPrefsSchema = readerPrefsSchema.catch({
  theme: "light",
  font: "sans",
  size: "md",
});

function readerPrefsFrom(req: NextRequest): ReaderPrefs {
  return queryReaderPrefsSchema.parse({
    theme: req.nextUrl.searchParams.get("theme") ?? undefined,
    font: req.nextUrl.searchParams.get("font") ?? undefined,
    size: req.nextUrl.searchParams.get("size") ?? undefined,
  });
}

// Serves sanitized article HTML for the inline preview (ADR-0007). Used when a
// target refuses iframe embedding; the preview panel points its sandboxed
// iframe here with `?url=...`. Always returns a self-contained HTML document —
// the article on success, or a minimal "couldn't preview" doc linking to the
// source — so the iframe never renders a blank page. Extraction results are
// cached in bookmark_extractions (TTL 24h, stale-while-revalidate).
export async function GET(req: NextRequest) {
  const { user } = await requireAuthSafe();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return new Response("Missing url", { status: 400 });
  }

  // "Refresh preview" (Raindrop parity): evict the cached row and extract
  // fresh instead of serving the 24h cache.
  if (req.nextUrl.searchParams.get("refresh") === "1") {
    await evictCached(url, "extract");
  }

  // Readable-document API (ADR-0007 phase 2): the panel renders extracted
  // content natively (no iframe) and needs structured JSON. The HTML iframe
  // path stays the default for the transition.
  const format = req.nextUrl.searchParams.get("format");
  if (format === "json") {
    return await jsonDocument(url, req);
  }

  try {
    const prefs = readerPrefsFrom(req);
    const cached = await readCached(url, "extract", revalidateExtract);
    if (cached) {
      return htmlResponse(
        cached.status === "ok" && cached.html
          ? articleHtml(
              {
                title: cached.title ?? url,
                byline: cached.byline,
                siteName: cached.siteName,
                excerpt: cached.excerpt,
                html: cached.html,
                url,
              },
              prefs,
            )
          : fallbackHtml(url, prefs),
      );
    }

    return await extractAndServe(url, prefs);
  } catch (error) {
    logger.error("Preview extraction route error", { url, error });
    return htmlResponse(fallbackHtml(url, readerPrefsFrom(req)));
  }
}

// Structured readable document for native rendering. Shares the extract
// cache and pipeline; only the response shape differs from the HTML path.
async function jsonDocument(url: string, _req: NextRequest): Promise<Response> {
  const cached = await readCached(url, "extract", revalidateExtract);
  const doc = cached ?? (await extractAndCache(url));

  const body = {
    url,
    ok: doc.status === "ok",
    title: doc.title ?? url,
    byline: doc.byline,
    siteName: doc.siteName,
    publishedTime: doc.publishedTime,
    excerpt: doc.excerpt,
    html: doc.status === "ok" ? doc.html : null,
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, max-age=300",
    },
  });
}

// ExtractionResult → cache document, one mapping for every caller (serve,
// json, revalidate). Keeps the "empty" shape in one place.
function docFrom(result: ExtractionResult): CacheDocument {
  return result.ok
    ? {
        status: "ok",
        title: result.content.title,
        byline: result.content.byline,
        siteName: result.content.siteName,
        publishedTime: result.content.publishedTime,
        excerpt: result.content.excerpt,
        html: result.content.html,
      }
    : EMPTY_DOC;
}

const EMPTY_DOC: CacheDocument = {
  status: "empty",
  title: null,
  byline: null,
  siteName: null,
  publishedTime: null,
  excerpt: null,
  html: null,
};

// Extract, persist to cache, and return the cache-shaped document.
async function extractAndCache(url: string): Promise<CacheDocument> {
  const result = await extractContent(url);
  const doc = docFrom(result);
  await writeCached(
    url,
    "extract",
    doc,
    result.ok ? result.content.length : null,
  );
  return doc;
}

async function extractAndServe(
  url: string,
  prefs: ReaderPrefs,
): Promise<Response> {
  const doc = await extractAndCache(url);
  if (doc.status !== "ok") {
    return htmlResponse(fallbackHtml(url, prefs));
  }
  // SAFETY: status "ok" only occurs with a successful extraction, so title/
  // html are the extraction's values; the ?? re-narrows nullable cache
  // columns to their write-time shape.
  return htmlResponse(
    articleHtml(
      {
        title: doc.title ?? url,
        byline: doc.byline,
        siteName: doc.siteName,
        excerpt: doc.excerpt,
        html: doc.html ?? "",
        url,
      },
      prefs,
    ),
  );
}

function revalidateExtract(url: string): void {
  revalidateInBackground(
    url,
    async (u) => {
      const result = await extractContent(u);
      return {
        ...docFrom(result),
        length: result.ok ? result.content.length : null,
      };
    },
    "extract",
  );
}

function htmlResponse(html: string): Response {
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, max-age=300",
    },
  });
}

// Reader styling, Raindrop parity. Rendered server-side inside the cached
// HTML so the iframe document is fully self-contained (no JS in the frame).
function readerCss(prefs: ReaderPrefs): string {
  const dark = prefs.theme === "dark";
  const fg = dark ? "#e6e6e6" : "#1a1a1a";
  const bg = dark ? "#111214" : "#ffffff";
  const muted = dark ? "#9a9a9a" : "#666";
  const quote = dark ? "#6a6a6a" : "rgba(127,127,127,0.4)";
  const preBg = dark ? "rgba(255,255,255,0.08)" : "rgba(127,127,127,0.12)";
  const link = dark ? "#8ab4f8" : "#1a73e8";
  const family =
    prefs.font === "serif"
      ? "Georgia, 'Iowan Old Style', 'Times New Roman', serif"
      : "system-ui, sans-serif";
  const baseSize =
    prefs.size === "sm" ? "14px" : prefs.size === "lg" ? "19px" : "16px";
  const h1Size =
    prefs.size === "sm" ? "1.4em" : prefs.size === "lg" ? "1.8em" : "1.6em";
  return `:root { color-scheme: ${prefs.theme}; }
body { max-width: 40rem; margin: 0 auto; padding: 2rem 1.5rem 4rem; font: ${baseSize}/1.7 ${family}; color: ${fg}; background: ${bg}; }
h1 { font-size: ${h1Size}; line-height: 1.3; }
h2,h3,h4 { line-height: 1.3; }
.byline { color: ${muted}; font-size: 0.9em; margin-top: -0.5em; }
img { max-width: 100%; height: auto; border-radius: 4px; }
pre { overflow-x: auto; background: ${preBg}; padding: 0.75rem; border-radius: 6px; }
code { font: 0.9em ui-monospace, monospace; }
blockquote { border-left: 3px solid ${quote}; margin-left: 0; padding-left: 1rem; color: ${muted}; }
a { color: ${link}; }
hr { border: 0; border-top: 1px solid ${quote}; margin: 2rem 0; }
table { border-collapse: collapse; }
th, td { border: 1px solid ${quote}; padding: 0.4em 0.6em; }
small { color: ${muted}; }
details { border: 1px solid ${quote}; border-radius: 6px; padding: 0.6rem 1rem; margin: 1rem 0; }
details > summary { cursor: pointer; font-weight: 600; }
h1 + a[href^="#"], h2 + a[href^="#"], h3 + a[href^="#"], h4 + a[href^="#"] { display: none; }
${githubTokenCss(dark)}`;
}

// GitHub pl-* syntax tokens (README code), matched to the reader theme.
// Only classes that survive the sanitizer's allowedClasses allowlist render.
function githubTokenCss(dark: boolean): string {
  const colors: [string, string][] = dark
    ? [
        ["pl-c", "#8b949e"],
        ["pl-c1, .pl-s .pl-v", "#79c0ff"],
        ["pl-e, .pl-en", "#7ee787"],
        ["pl-s, .pl-pse, .pl-s1, .pl-ent", "#a5d6ff"],
        ["pl-v, .pl-smw", "#ffa657"],
        ["pl-k", "#ff7b72"],
        ["pl-ent", "#7ee787"],
      ]
    : [
        ["pl-c", "#6a737d"],
        ["pl-c1, .pl-s .pl-v", "#005cc5"],
        ["pl-e, .pl-en", "#22863a"],
        ["pl-s, .pl-pse, .pl-s1", "#032f62"],
        ["pl-v, .pl-smw", "#e36209"],
        ["pl-k", "#d73a49"],
        ["pl-ent", "#22863a"],
      ];
  return colors
    .map(([sel, c]) => `.${sel.replace(/, /g, ", .")} { color: ${c}; }`)
    .join("\n");
}

function articleHtml(
  content: {
    title: string;
    byline: string | null;
    siteName: string | null;
    excerpt: string | null;
    html: string;
    url: string;
  },
  prefs: ReaderPrefs,
): string {
  const byline = content.byline
    ? `<p class="byline">${escapeHtml(content.byline)}${content.siteName ? ` · ${escapeHtml(content.siteName)}` : ""}</p>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(content.title)}</title>
<style>
${readerCss(prefs)}
</style>
</head>
<body>
<article>
<h1>${escapeHtml(content.title)}</h1>
${byline}
${content.html}
</article>
</body>
</html>`;
}

function fallbackHtml(url: string, prefs: ReaderPrefs): string {
  const escaped = escapeHtml(url);
  const dark = prefs.theme === "dark";
  const fg = dark ? "#e6e6e6" : "#1a1a1a";
  const bg = dark ? "#111214" : "#ffffff";
  const muted = dark ? "#9a9a9a" : "#666";
  const link = dark ? "#8ab4f8" : "#1a73e8";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Preview unavailable</title>
<style>
:root { color-scheme: ${prefs.theme}; }
body { display: flex; min-height: 100vh; margin: 0; align-items: center; justify-content: center; font: 16px/1.6 system-ui, sans-serif; color: ${fg}; background: ${bg}; }
.card { text-align: center; padding: 2rem; max-width: 24rem; }
p { color: ${muted}; }
a { color: ${link}; }
</style>
</head>
<body>
<div class="card">
<p><strong>Preview unavailable</strong></p>
<p>This page couldn't be extracted for inline preview.</p>
<a href="${escaped}" target="_blank" rel="noopener noreferrer">Open in new tab</a>
</div>
</body>
</html>`;
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
