import { extractMetadataFromHtml } from "./extract";
import { isSafeUrl, resolveFavicon, safeFetchHtml } from "./fetch";
import { fallbackStrategy, fetchViaMicrolink } from "./strategies";
import type { Metadata } from "./types";
import { createBasicMetadata } from "./utils";

export { isSafeUrl } from "./fetch";

const CACHE_TTL = 24 * 60 * 60 * 1000;

interface CacheEntry {
  data: Metadata;
  expiry: number;
}

const metadataCache = new Map<string, CacheEntry>();

function getCachedMetadata(url: string): Metadata | null {
  const cached = metadataCache.get(url);
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }
  metadataCache.delete(url);
  return null;
}

function setCachedMetadata(url: string, data: Metadata): void {
  metadataCache.set(url, { data, expiry: Date.now() + CACHE_TTL });
}

export async function fetchMetadata(url: string): Promise<Metadata> {
  const cached = getCachedMetadata(url);
  if (cached) return cached;

  const urlObj = new URL(url);
  const hostname = urlObj.hostname;

  const [isSafe, fallbackResult] = await Promise.all([
    isSafeUrl(url),
    fallbackStrategy(url, hostname).catch(() => null),
  ]);

  if (!isSafe) {
    const basic = createBasicMetadata(url, hostname);
    setCachedMetadata(url, basic);
    return basic;
  }

  if (fallbackResult) {
    setCachedMetadata(url, fallbackResult);
    return fallbackResult;
  }

  const [fetchResult, microlinkPromise] = await Promise.all([
    safeFetchHtml(url).catch(() => null),
    fetchViaMicrolink(url).catch(() => null),
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

  setCachedMetadata(url, finalMetadata);
  return finalMetadata;
}
