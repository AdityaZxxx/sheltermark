import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

import type { ExtractedContent } from "./types";

export function extractArticle(
  html: string,
  url: string,
): ExtractedContent | null {
  const dom = new JSDOM(html, { url });
  const article = new Readability(dom.window.document, {
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
