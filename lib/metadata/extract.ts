import { load } from "cheerio";
import type { Metadata } from "./types";
import { decodeHtmlEntities, resolveUrl } from "./utils";

export function extractMetadataFromHtml(
  html: string,
  baseUrl: string,
): Omit<Metadata, "favicon_url"> & { favicon_url: string | null } {
  const $ = load(html);

  const getMeta = (selectors: string[]): string | null => {
    for (const selector of selectors) {
      const el = $(selector);
      const content = el.attr("content") || el.attr("href") || el.text();
      if (content?.trim()) return content.trim();
    }
    return null;
  };

  const title =
    getMeta([
      'meta[property="og:title"]',
      'meta[name="twitter:title"]',
      'meta[name="title"]',
      "title",
    ]) || new URL(baseUrl).hostname;

  const ogImage = resolveUrl(
    getMeta([
      'meta[property="og:image"]',
      'meta[name="twitter:image"]',
      'link[rel="image_src"]',
      'meta[itemprop="image"]',
    ]),
    baseUrl,
  );

  const favicon = resolveUrl(
    getMeta([
      'link[rel="apple-touch-icon"]',
      'link[rel="icon"]',
      'link[rel="shortcut icon"]',
      'link[rel="mask-icon"]',
    ]),
    baseUrl,
  );

  return {
    title: decodeHtmlEntities(title.trim() || new URL(baseUrl).hostname),
    og_image_url: ogImage,
    favicon_url: favicon,
  };
}
