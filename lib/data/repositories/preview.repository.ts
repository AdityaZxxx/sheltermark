import { and, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { z } from "zod";

import type { DrizzleDb } from "~/lib/data/db";

import { bookmarkExtractions } from "~/lib/data/schema";
import {
  previewDocumentKindSchema,
  type PreviewDocumentKind,
} from "~/lib/schemas/preview.schema";

const EXTRACT_TTL_MS = 24 * 60 * 60 * 1000;
const PROXY_TTL_MS = 60 * 60 * 1000;

const TTL_BY_KIND = {
  extract: EXTRACT_TTL_MS,
  // Native renders track the live page more closely and are bigger; keep them
  // fresher than article extractions.
  proxy: PROXY_TTL_MS,
} as const satisfies Record<PreviewDocumentKind, number>;

interface ExtractionRow {
  url: string;
  kind: PreviewDocumentKind;
  status: "ok" | "empty";
  title: string | null;
  byline: string | null;
  siteName: string | null;
  publishedTime: string | null;
  excerpt: string | null;
  html: string | null;
  length: number | null;
  fetchedAt: string;
}

export function urlHash(url: string): string {
  return createHash("sha256").update(normalize(url)).digest("hex");
}

// Strip the fragment so the same article under minor URL variants (with and
// without #anchor) shares one cache row. Query strings stay distinct.
function normalize(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString();
  } catch {
    return url;
  }
}

export async function findExtraction(
  db: DrizzleDb,
  hash: string,
  kind: PreviewDocumentKind,
): Promise<ExtractionRow | null> {
  const parsedKind = previewDocumentKindSchema.parse(kind);
  const rows = await db
    .select({
      url: bookmarkExtractions.url,
      kind: bookmarkExtractions.kind,
      status: bookmarkExtractions.status,
      title: bookmarkExtractions.title,
      byline: bookmarkExtractions.byline,
      siteName: bookmarkExtractions.site_name,
      publishedTime: bookmarkExtractions.published_time,
      excerpt: bookmarkExtractions.excerpt,
      html: bookmarkExtractions.html,
      length: bookmarkExtractions.length,
      fetchedAt: bookmarkExtractions.fetched_at,
    })
    .from(bookmarkExtractions)
    .where(
      and(
        eq(bookmarkExtractions.url_hash, hash),
        eq(bookmarkExtractions.kind, parsedKind),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return {
    url: row.url,
    // SAFETY: DB CHECK constraint `bookmark_extractions_kind_check`
    // guarantees kind ∈ ('extract', 'proxy'); the cast narrows text to the
    // schema enum.
    kind: row.kind as PreviewDocumentKind,
    // SAFETY: DB CHECK constraint `bookmark_extractions_status_check`
    // guarantees status ∈ ('ok', 'empty'); the cast narrows text to the
    // schema enum.
    status: row.status as "ok" | "empty",
    title: row.title,
    byline: row.byline,
    siteName: row.siteName,
    publishedTime: row.publishedTime,
    excerpt: row.excerpt,
    html: row.html,
    length: row.length,
    fetchedAt: row.fetchedAt,
  };
}

const upsertExtractionSchema = z.object({
  hash: z.string(),
  kind: previewDocumentKindSchema,
  url: z.string(),
  status: z.enum(["ok", "empty"]),
  title: z.string().nullable(),
  byline: z.string().nullable(),
  siteName: z.string().nullable(),
  publishedTime: z.string().nullable(),
  excerpt: z.string().nullable(),
  html: z.string().nullable(),
  length: z.number().int().nullable(),
});

export async function upsertExtraction(
  db: DrizzleDb,
  row: z.input<typeof upsertExtractionSchema>,
): Promise<void> {
  const parsed = upsertExtractionSchema.parse(row);
  const fetchedAt = new Date().toISOString();
  const values = {
    url_hash: parsed.hash,
    kind: parsed.kind,
    url: parsed.url,
    status: parsed.status,
    title: parsed.title,
    byline: parsed.byline,
    site_name: parsed.siteName,
    published_time: parsed.publishedTime,
    excerpt: parsed.excerpt,
    html: parsed.html,
    length: parsed.length,
    fetched_at: fetchedAt,
  };
  await db
    .insert(bookmarkExtractions)
    .values(values)
    .onConflictDoUpdate({
      target: [bookmarkExtractions.kind, bookmarkExtractions.url_hash],
      set: {
        url: values.url,
        status: values.status,
        title: values.title,
        byline: values.byline,
        site_name: values.site_name,
        published_time: values.published_time,
        excerpt: values.excerpt,
        html: values.html,
        length: values.length,
        fetched_at: fetchedAt,
      },
    });
}

export function isFresh(
  fetchedAt: string,
  kind: PreviewDocumentKind = "extract",
): boolean {
  return Date.now() - new Date(fetchedAt).getTime() < TTL_BY_KIND[kind];
}

// Manual "Refresh preview": drop the cached row so the next read extracts
// fresh (Raindrop parity for the broken-preview escape hatch).
export async function deleteExtraction(
  db: DrizzleDb,
  hash: string,
  kind: PreviewDocumentKind,
): Promise<void> {
  const parsedKind = previewDocumentKindSchema.parse(kind);
  await db
    .delete(bookmarkExtractions)
    .where(
      and(
        eq(bookmarkExtractions.url_hash, hash),
        eq(bookmarkExtractions.kind, parsedKind),
      ),
    );
}
