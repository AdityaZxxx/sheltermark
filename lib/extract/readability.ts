import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

import type { ExtractedContent } from "./types";

// ponytail: linkedom instead of jsdom. jsdom is on Next's default
// serverExternalPackages list, and Turbopack 16.3 emits hashed-alias externals
// (jsdom-<hash> via .next/node_modules symlinks) that Vercel's lambda packing
// drops (vercel/next.js#89851); its dep tree is also ESM-only in places the
// lambda Node cannot require(). linkedom is bundled into the server chunk
// (not externalized), has zero runtime deps, and covers our exact need:
// parse → Readability → serialize. Revisit if we ever need jsdom's browser
// emulation (script execution, resource loading, cookie jars).
export function extractArticle(
  html: string,
  url: string,
): ExtractedContent | null {
  const { document } = parseHTML(html);
  // linkedom has no { url } option; Readability's _fixRelativeUris reads
  // document.baseURI to absolutize relative links/images, and falls back to
  // documentURI for in-page hash links. defineProperty shadows linkedom's
  // <base>-derived getter without mutating the HTML (string-level <base>
  // injection corrupts head parsing for documents without an explicit <head>).
  Object.defineProperty(document, "baseURI", { value: url });
  Object.defineProperty(document, "documentURI", { value: url });

  const article = new Readability(document, {
    charThreshold: 120,
  }).parse();

  return article?.content
    ? {
        title: article.title ?? url,
        byline: article.byline ?? null,
        siteName: article.siteName ?? null,
        excerpt: article.excerpt ?? null,
        html: article.content,
        length: article.textContent?.length ?? 0,
        url,
      }
    : null;
}
