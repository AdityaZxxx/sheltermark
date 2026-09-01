import { z } from "zod";

export const previewDocumentKindSchema = z.enum(["extract", "proxy"]);
export type PreviewDocumentKind = z.infer<typeof previewDocumentKindSchema>;

// Readable-document payload served by /api/preview?format=json and parsed at
// the client I/O boundary (ADR-0007 phase 2).
export const previewDocSchema = z.object({
  url: z.string(),
  ok: z.boolean(),
  title: z.string(),
  byline: z.string().nullable().catch(null),
  siteName: z.string().nullable().catch(null),
  publishedTime: z.string().nullable().catch(null),
  excerpt: z.string().nullable().catch(null),
  html: z.string().nullable().catch(null),
});
export type PreviewDoc = z.infer<typeof previewDocSchema>;
