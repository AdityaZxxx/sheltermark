import { logger } from "../logger";
import { extractMetadataFromHtml } from "./extract";
import { isSafeUrl, resolveFavicon, safeFetchHtml } from "./fetch";
import { fallbackStrategy, fetchViaMicrolink } from "./strategies";
import type { Metadata } from "./types";
import { createBasicMetadata } from "./utils";

export async function fetchMetadata(url: string): Promise<Metadata> {
  const urlObj = new URL(url);
  const hostname = urlObj.hostname;

  const [isSafe, fallbackResult] = await Promise.all([
    isSafeUrl(url),
    fallbackStrategy(url, hostname).catch((err) => {
      logger.warn("Fallback strategy failed", { url, error: err });
      return null;
    }),
  ]);

  if (!isSafe) {
    return createBasicMetadata(url, hostname);
  }

  if (fallbackResult) {
    return fallbackResult;
  }

  const [fetchResult, microlinkPromise] = await Promise.all([
    safeFetchHtml(url).catch((err) => {
      logger.warn("Safe fetch HTML failed", { url, error: err });
      return null;
    }),
    fetchViaMicrolink(url).catch((err) => {
      logger.warn("Microlink fetch failed", { url, error: err });
      return null;
    }),
  ]);

  let finalMetadata: Metadata;

  if (!fetchResult) {
    if (microlinkPromise) {
      finalMetadata = microlinkPromise;
    } else {
      finalMetadata = createBasicMetadata(url, hostname);
    }
  } else {
    const { html, finalUrl } = fetchResult;
    const metadata = extractMetadataFromHtml(html, finalUrl);

    if (metadata.title === hostname && !metadata.og_image_url) {
      if (microlinkPromise && microlinkPromise.title !== url) {
        finalMetadata = microlinkPromise;
      } else {
        finalMetadata = metadata;
      }
    } else {
      finalMetadata = metadata;
    }

    const faviconUrl = await resolveFavicon(
      hostname,
      finalMetadata.favicon_url,
    );
    finalMetadata = { ...finalMetadata, favicon_url: faviconUrl };
  }

  return finalMetadata;
}
