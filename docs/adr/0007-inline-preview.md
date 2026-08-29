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

## Cache

`bookmark_extractions` keyed by `(kind, url_hash)`: extraction rows TTL 24h,
proxy rows TTL 1h (tracks the live page); stale-while-revalidate on both.
Reads/writes go through the repository layer as usual.
