import type { PreviewDocumentKind } from "~/lib/schemas/preview.schema";

import { getDb } from "~/lib/data/db";
import {
  deleteExtraction,
  findExtraction,
  isFresh,
  upsertExtraction,
  urlHash,
} from "~/lib/data/repositories/preview.repository";
import { logger } from "~/lib/utils/logger";

export interface CacheDocument {
  status: "ok" | "empty";
  title: string | null;
  byline: string | null;
  siteName: string | null;
  publishedTime: string | null;
  excerpt: string | null;
  html: string | null;
}

// Stale-while-revalidate read for preview documents (ADR-0007). Returns the
// cached document when a row exists — serving it stale and refreshing in the
// background when the TTL lapsed — or null when there is nothing to serve.
// One shared implementation so the extract and proxy routes stay in step.
export async function readCached(
  url: string,
  kind: PreviewDocumentKind,
  onStale: (url: string) => void,
): Promise<CacheDocument | null> {
  if (!process.env.DATABASE_URL) return null;
  const hash = urlHash(url);
  const cached = await findExtraction(getDb(), hash, kind);
  if (!cached) return null;
  if (!isFresh(cached.fetchedAt, kind)) onStale(url);
  return {
    status: cached.status,
    title: cached.title,
    byline: cached.byline,
    siteName: cached.siteName,
    publishedTime: cached.publishedTime,
    excerpt: cached.excerpt,
    html: cached.html,
  };
}

// Best-effort cache write; a failed write degrades to uncached previews,
// never a failed request.
export async function writeCached(
  url: string,
  kind: PreviewDocumentKind,
  doc: CacheDocument,
  length: number | null,
): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    await upsertExtraction(getDb(), {
      hash: urlHash(url),
      kind,
      url,
      status: doc.status,
      title: doc.title,
      byline: doc.byline,
      siteName: doc.siteName,
      publishedTime: doc.publishedTime,
      excerpt: doc.excerpt,
      html: doc.html,
      length,
    });
  } catch (error) {
    logger.warn("Preview cache write failed", { url, error });
  }
}

// ponytail: fire-and-forget refresh; a dropped revalidation just means the
// row stays stale until the next request (and the TTL re-trigger). Add a
// queue if staleness complaints appear.
export function revalidateInBackground(
  url: string,
  refresh: (url: string) => Promise<CacheDocument & { length: number | null }>,
  kind: PreviewDocumentKind,
): void {
  void refresh(url)
    .then((doc) => writeCached(url, kind, doc, doc.length))
    .catch((error) => {
      logger.warn(`Preview background revalidate failed (${kind})`, {
        url,
        error,
      });
    });
}

// "Refresh preview" support: evict a cached document so the next read
// extracts fresh. Best-effort — a failed eviction degrades to the cached
// doc, never a failed request.
export async function evictCached(
  url: string,
  kind: PreviewDocumentKind,
): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    await deleteExtraction(getDb(), urlHash(url), kind);
  } catch (error) {
    logger.warn("Preview cache evict failed", { url, error });
  }
}
