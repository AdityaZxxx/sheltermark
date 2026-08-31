# 0009: linkedom over jsdom for server-side article extraction

**Date**: 2026-08-31
**Status**: Accepted

## Context

The inline preview's reader mode (ADR-0007) extracts article content
server-side via `@mozilla/readability`, which needs a DOM implementation to
parse fetched HTML. It used jsdom.

In production (Vercel lambdas) every jsdom-based deployment failed at module
load with one of two errors, depending on the function runtime:

```
Failed to load external module jsdom-<hash>
ResolveMessage: Cannot find module '../data/patch.json' from ''
ERR_REQUIRE_ESM: require() of ES Module .../@exodus/bytes/encoding-lite.js
```

Root cause, proven against live lambdas and reproduced locally: jsdom is on
Next.js's default `serverExternalPackages` list, and Turbopack (16.3)
externalizes such packages as **hashed aliases** — `require('jsdom-<hash>')`
resolved through symlinks under `.next/node_modules/` — whose targets are
dropped by Vercel's strict NFT-based lambda packing (vercel/next.js#89851,
#87737). Even when the full dependency tree was force-included via
`outputFileTracingIncludes`, jsdom 30's dependency chain ships ESM-only
modules (`@exodus/bytes` via `html-encoding-sniffer`) that the lambda's
`require()` cannot load (`ERR_REQUIRE_ESM`). Local dev never surfaced either
failure: the symlinks are intact locally, and Bun's `require()` loads ES
modules natively.

Three workaround attempts (externalize explicitly; Bun runtime via
`vercel.json`; runtime `createRequire()` + force-traced dep tree) were each
deployed, verified broken, and reverted.

## Decision

Use **linkedom** as the DOM implementation for `extractArticle()`
(`lib/extract/readability.ts`).

- linkedom is **not** on the serverExternalPackages list, so Turbopack bundles
  it into the server chunk: no external require, no hashed alias, no lambda
  Node-version dependence, no manual output tracing.
- It has zero runtime dependencies; the `ERR_REQUIRE_ESM` failure class cannot
  occur.
- Its parse → serialize coverage matches our exact need. Readability's
  `document.baseURI` (used to absolutize relative URLs) is provided via
  `Object.defineProperty` on the parsed document — string-level `<base href>`
  injection corrupts head parsing for documents without an explicit `<head>`.

jsdom stays as a **devDependency only**, backing `tests/parity/` — a
regression suite asserting linkedom and jsdom produce identical extraction
results (title, byline, excerpt, length, relative/absolute URLs, malformed
HTML, sub-threshold pages) through Readability.

## Consequences

- Extraction runs inside the bundled server chunk; the `/api/preview` lambda
  no longer carries ~1500 traced jsdom files.
- linkedom is not a browser: no script execution, resource loading, cookie
  jars, or charset sniffing (`safeFetchHtml` already delivers decoded strings,
  so this is not a behavior change today). If a future feature needs real
  browser emulation, revisit this ADR.
- Serialization differs cosmetically from jsdom (tag case, attribute order);
  downstream `sanitizeContent` normalizes both, and parity tests assert
  semantics rather than byte equality.
- If Turbopack fixes hashed-alias externals upstream, jsdom could return, but
  linkedom's smaller footprint and simpler packaging remain preferable for
  this use case.
