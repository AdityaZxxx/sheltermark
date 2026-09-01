# Inline preview: resolver chain, extraction pipeline, and native proxy

**Status**: Accepted

The inline bookmark preview (split-pane iframe beside the list) needs a
policy for which URLs render inline and how. Most high-value sites refuse
framing, so a binary "frame it or give up" model degrades to a link. We
decided on a typed, ordered resolver chain that maps every bookmark to one
render instruction, with a server-side extraction pipeline and a
GitHub-only native-render proxy behind it.

## Decision: the resolver chain

`resolvePreview(bookmark) → PreviewKind` (lib/preview/resolve.ts) runs
strategies cheapest/most-native first; the first match wins:

| #   | Strategy                   | Kind              | What it does                                                                                                                                                                             |
| --- | -------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Provider embed             | `embed`           | Pure URL transform into the provider's frameable embed endpoint (YouTube nocookie, Spotify, SoundCloud, Vimeo). No server fetch.                                                         |
| 2   | Native proxy               | `proxy`           | GitHub/gist URLs (https-only — http URLs fall through to the iframe/extraction chain rather than 403 at the route) → `/api/preview/web`, a re-served transform of the real page (below). |
| 3   | Platform strategy          | `server`          | Framing-hostile sites with structured data sources: HN items (DOM parse), X statuses (fxtwitter API), Reddit threads (public `.json` API).                                               |
| 4   | Direct iframe / extraction | `iframe`/`server` | Unresolved URLs start optimistic as `iframe`; the panel probes embeddability (`checkEmbeddable`) and downgrades to generic Readability extraction via `/api/preview`.                    |
| 5   | External                   | `external`        | Nothing works → "Open in new tab" fallback state.                                                                                                                                        |

The panel is kind-agnostic: it renders whatever kind comes back, so new
strategies require zero UI changes. Platform predicates (`isXStatus`,
`isRedditThread`, `isHackerNewsItem`) live on the adapters and are reused by
the resolver — one definition of "an HN item / X status / Reddit thread" per
platform. A framing failure of the final `iframe` kind is handled by the
panel's timeout/blocked state, not a distinct kind.

## Extraction pipeline (strategies 3 and 4)

`lib/extract/` — fetch (SSRF-guarded `safeFetchHtml`, no user cookies,
`Sheltermark/1.0` UA) → adapter or generic Readability → sanitize
(`sanitize-html` allowlist, malicious-HTML fixtures in CI) → absolutize
URLs → serve from `/api/preview` behind auth. Reader appearance controls
(theme/font/size) live in the panel header and are passed as query params.

## Native proxy: the Raindrop recipe (strategy 2)

Raindrop's GitHub preview renders natively **without running GitHub's
JavaScript**. Byte-diffing their proxy output against raw github.com HTML
(2026-08-29) revealed the recipe, which we replicate
(lib/preview/github-proxy.ts): keep the DOM intact (classes, `hidden`
fallbacks, `<template>`s — DOM integrity IS the product; a class/attr
allowlist pass broke the render in an earlier attempt), remove all
`<script>` tags, unwrap `<noscript>`, drop
iframe/object/embed/form/meta-refresh, inject `<base href>`, absolutize +
promote lazy attrs, and add a small overlay style that hides broken no-JS
fallbacks and constrains GitHub's wide layout to the pane. GitHub's own
CSS alone produces the native look.

Security is layered, not DOM surgery: script removal → response CSP
`script-src 'none'` → sandbox without `allow-scripts`/`allow-same-origin` →
forms/frames removed → anchors forced `rel="noopener noreferrer"
target="_blank"`. GitHub-only (github.com, gist.github.com, https-only);
each new host is a deliberate decision with its own verification — there
is deliberately no arbitrary-URL proxy mode.

## Sandbox matrix

| Kind             | Sandbox                                            | Referrer                                                                                          |
| ---------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `embed`          | popups + presentation + scripts + same-origin      | `strict-origin-when-cross-origin` (players refuse to play without a referrer — YouTube Error 153) |
| `iframe`         | downloads + forms + popups + same-origin + scripts | `no-referrer`                                                                                     |
| `proxy`/`server` | popups only                                        | `no-referrer`                                                                                     |

## Content classification and media kinds (phase 3)

`lib/preview/classify.ts` maps content to a _class_ — `pdf`, `image`,
`video`, `audio`, `html` — kept strictly separate from the _rendering
strategy_. Detection is content-first: the embeddability probe's
Content-Type header is authoritative; URL extension/shape heuristics are
only the optimistic pre-fetch guess (the one structural exception:
arXiv-style `/pdf/<id>` paths). Domain knowledge stays in the resolver's
provider/platform strategies — the classifier never special-cases a site.

`effectivePreview(bookmark, probe)` refines the generic `iframe` fallback
with the classification: non-HTML routes to the media proxy
(`/api/preview/media?url=…`) as a `pdf`/`image`/`video`/`audio` kind; HTML
keeps the iframe-or-extraction path. Domain strategies always win —
classification only refines unresolved URLs.

## Media proxy

`/api/preview/media` re-serves PDFs, images, audio and video bytes from our
origin behind auth + the same SSRF guard as extraction (https-only,
private-IP/DNS on every redirect hop), restricted to media Content-Types
(never an open HTML proxy), 10 MB hard cap, private no-store-ish caching,
`nosniff`. PDFs are rendered client-side by pdf.js (worker vendored at
`/vendor/pdf.worker.min.mjs`, drift-guarded by a unit test against the
pinned pdfjs-dist version) — no third-party frame, consistent panel chrome.

## Readable documents (phase 2)

Text-heavy pages (articles, papers, docs) extract through the same
pipeline; `/api/preview?format=json` serves the structured document
(title, byline, siteName, publishedTime, excerpt, sanitized HTML) parsed
client-side by a Zod schema. The Reader tab renders it natively as React
DOM (`ReadableDocument`) instead of a sandboxed iframe when extraction
succeeds — the sanitizer output is the security boundary either way.
Metadata now includes `publishedTime` (meta `article:published_time` /
`<time datetime>`), cached in `bookmark_extractions.published_time`.

## Cache

`bookmark_extractions` keyed by `(kind, url_hash)`: extraction rows TTL 24h,
proxy rows TTL 1h (tracks the live page); stale-while-revalidate on both.
Reads/writes go through the repository layer as usual.
