export interface ExtractedContent {
  title: string;
  byline: string | null;
  siteName: string | null;
  excerpt: string | null;
  html: string;
  length: number;
  url: string;
  // Base for resolving relative links/images in `html`; defaults to `url`.
  // Adapters whose content isn't strictly page-relative (e.g. a GitHub
  // README rendered from the repo root) set this explicitly.
  baseUrl?: string;
}

export type ExtractionResult =
  | { ok: true; content: ExtractedContent }
  | { ok: false; reason: "unsafe-url" | "fetch-failed" | "not-extractable" };
