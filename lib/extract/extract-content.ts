import { isSafeUrl, safeFetchHtml } from "~/lib/metadata/fetch";
import { logger } from "~/lib/utils/logger";

import type { ExtractedContent, ExtractionResult } from "./types";

import { absolutize } from "./absolutize";
import { findAdapter } from "./adapters";
import { extractArticle } from "./readability";
import { sanitizeContent } from "./sanitize";

// Server-side content extraction for the inline preview. Used when a target
// refuses iframe embedding: fetch → site adapter or Readability → sanitize →
// clean article HTML, served from our own origin in a sandboxed iframe. See
// ADR-0007.
export async function extractContent(url: string): Promise<ExtractionResult> {
  if (!(await isSafeUrl(url))) {
    return { ok: false, reason: "unsafe-url" };
  }

  const fetched = await safeFetchHtml(url).catch((err) => {
    logger.warn("Preview extract fetch failed", { url, error: err });
    return null;
  });

  if (!fetched) {
    return { ok: false, reason: "fetch-failed" };
  }

  // Site adapter first (precise selectors/APIs for known sites), generic
  // Readability extraction as the fallback.
  const adapter = findAdapter(url);
  const adapted =
    adapter === null
      ? null
      : adapter.kind === "fetch"
        ? await adapter.fetch(url).catch((err) => {
            logger.warn("Preview adapter fetch failed", {
              url,
              name: adapter.name,
              error: err,
            });
            return null;
          })
        : adapter.adapt(fetched.html, fetched.finalUrl);
  const article = adapted ?? extractArticle(fetched.html, fetched.finalUrl);
  if (!article || !article.html) {
    return { ok: false, reason: "not-extractable" };
  }

  const content: ExtractedContent = {
    title: article.title ?? url,
    byline: article.byline,
    siteName: article.siteName,
    publishedTime: article.publishedTime,
    excerpt: article.excerpt,
    // Absolutize before sanitizing so relative links/images resolve against
    // the source site, not our origin; sanitize afterwards to scrub whatever
    // the rewrite produced.
    html: sanitizeContent(
      absolutize(article.html, article.baseUrl ?? fetched.finalUrl),
    ),
    length: article.length,
    url: fetched.finalUrl,
  };

  return { ok: true, content };
}
