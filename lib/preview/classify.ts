// Content/preview classification (ADR-0007). Maps a URL plus — when known —
// the origin's HTTP content type to a preview content class. Detection is
// content-first: URL heuristics are the optimistic client-side guess before
// any fetch, while the authoritative answer comes from the embeddability
// probe's Content-Type header (see checkEmbeddable). Domain rules are
// deliberately *not* used here; the resolver's provider/platform strategies
// handle the few sites that need domain knowledge, and this layer only
// describes *what the content is*, never *how to render it* — the panel maps
// class → component.
//
// Pure URL/string logic only, no Node builtins: safe to import from client
// components (same rule as lib/preview/embeds.ts).

type PreviewClass = "pdf" | "image" | "video" | "audio" | "html";

// File-extension → class. Content-Type is checked first when available; this
// table answers "what will this URL probably be" before any network call.
const EXTENSION_CLASSES = {
  pdf: "pdf",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  avif: "image",
  svg: "image",
  bmp: "image",
  ico: "image",
  mp4: "video",
  webm: "video",
  mov: "video",
  m4v: "video",
  mp3: "audio",
  wav: "audio",
  ogg: "audio",
  m4a: "audio",
  opus: "audio",
} as const satisfies Record<string, PreviewClass>;

function extensionClass(pathname: string): PreviewClass | null {
  // Last path segment only, and it must be a true ".ext" file name — a bare
  // trailing segment ("/uploads/mp3") is a route, not a file.
  const last = pathname.split("/").pop() ?? "";
  const ext = /\.([a-z0-9]+)$/i.exec(last)?.[1]?.toLowerCase();
  if (!ext) return null;
  // SAFETY: the asserted intersection keeps every literal key's known value
  // (partial side) while admitting arbitrary string keys with an undefined
  // result — a lookup miss, not an unsound value.
  const direct = (
    EXTENSION_CLASSES as Record<string, PreviewClass | undefined> &
      Partial<Record<keyof typeof EXTENSION_CLASSES, PreviewClass>>
  )[ext];
  return direct ?? null;
}

// arXiv /pdf/<id> URLs serve application/pdf but end in a bare id with no
// .pdf extension — the one structural (non-domain) exception worth handling.
// Everything else relies on content-type first, extension second.
function looksLikePdfPath(pathname: string): boolean {
  return /\/pdf\/[^/]+$/i.test(pathname);
}

// Optimistic guess from the URL alone. Runs client-side before the probe.
export function classifyUrl(url: string): PreviewClass | null {
  try {
    const { pathname } = new URL(url);
    if (looksLikePdfPath(pathname)) return "pdf";
    return extensionClass(pathname);
  } catch {
    return null;
  }
}

// Authoritative classification from an HTTP Content-Type header value.
export function classifyContentType(
  contentType: string | null,
): PreviewClass | null {
  if (!contentType) return null;
  const mime = contentType.split(";")[0]?.trim().toLowerCase();
  if (!mime) return null;
  if (mime === "application/pdf" || mime === "application/x-pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (
    mime.startsWith("text/html") ||
    mime.startsWith("application/xhtml") ||
    mime === "text/plain" ||
    mime.startsWith("text/xml") ||
    mime.startsWith("application/xml")
  ) {
    return "html";
  }
  return null;
}
