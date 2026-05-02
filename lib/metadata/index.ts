import { extractMetadataFromHtml } from "./extract";
import { isSafeUrl, resolveFavicon, safeFetchHtml } from "./fetch";
import { fallbackStrategy, fetchViaMicrolink } from "./strategies";
import type { Metadata } from "./types";
import { createBasicMetadata } from "./utils";

const CACHE_TTL = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;

interface CacheEntry {
  data: Metadata;
  expiry: number;
}

class BoundedLRUCache {
  private cache: Map<string, CacheEntry>;
  private readonly maxSize: number;
  private readonly ttl: number;

  constructor(maxSize: number, ttl: number) {
    this.cache = new Map<string, CacheEntry>();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(url: string): Metadata | null {
    const entry = this.cache.get(url);
    if (!entry) return null;

    if (entry.expiry <= Date.now()) {
      this.cache.delete(url);
      return null;
    }

    this.cache.delete(url);
    this.cache.set(url, entry);
    return entry.data;
  }

  set(url: string, data: Metadata): void {
    this.cache.delete(url);
    while (this.cache.size >= this.maxSize) {
      const lruKey = this.cache.keys().next().value;
      if (lruKey === undefined) break;
      this.cache.delete(lruKey as string);
    }

    this.cache.set(url, { data, expiry: Date.now() + this.ttl });
  }

  get size(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
  }
}

const metadataCache = new BoundedLRUCache(MAX_CACHE_ENTRIES, CACHE_TTL);

function getCachedMetadata(url: string): Metadata | null {
  return metadataCache.get(url);
}

function setCachedMetadata(url: string, data: Metadata): void {
  metadataCache.set(url, data);
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
