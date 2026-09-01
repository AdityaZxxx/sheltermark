import type { NextRequest } from "next/server";

import { requireAuthSafe } from "~/lib/auth";
import { isSafeUrl } from "~/lib/metadata/fetch";
import { httpFetch, readArrayBufferWithLimit } from "~/lib/utils/http-fetch";
import { logger } from "~/lib/utils/logger";

// Media proxy for the inline preview (ADR-0007): PDFs, images, audio and
// video the classifier routed away from the iframe path. The panel never
// fetches cross-origin media directly — pdf.js needs a same-origin worker,
// and hotlink-protected origins break plain <img>/<video> — so this route
// re-serves the bytes from our origin behind auth + the same SSRF guard as
// the extraction pipeline (https-only, private-IP/DNS validation on every
// redirect hop). No caching: media is streamed per request, size-capped.
const MAX_MEDIA_BYTES = 10 * 1024 * 1024;

// Content types we proxy. Anything else (HTML especially — that's the
// extraction route's job) is refused so this can't become an open proxy.
const ALLOWED_TYPE_PREFIXES = ["image/", "audio/", "video/"];
const ALLOWED_TYPES = new Set(["application/pdf", "application/x-pdf"]);

function isAllowedMedia(contentType: string | null): boolean {
  const mime = contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
  return (
    ALLOWED_TYPES.has(mime) ||
    ALLOWED_TYPE_PREFIXES.some((p) => mime.startsWith(p))
  );
}

export async function GET(req: NextRequest) {
  const { user } = await requireAuthSafe();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return new Response("Missing url", { status: 400 });
  }

  try {
    if (!(await isSafeUrl(url))) {
      return new Response("Unavailable", { status: 403 });
    }

    const { response } = await httpFetch(url, {
      followRedirect: { maxHops: 5 },
      onRedirectHop: isSafeUrl,
    });

    if (!response.ok) {
      return new Response("Upstream unavailable", { status: 502 });
    }

    const contentType = response.headers.get("content-type");
    if (!isAllowedMedia(contentType)) {
      // Content-Type said HTML but the URL looked like media — serve the
      // generic "open in new tab" answer rather than proxying a document.
      return new Response("Not a media document", { status: 415 });
    }

    // Throws when the file exceeds the cap; the catch turns it into a 413
    // instead of proxying a truncated, corrupt file.
    const body = await readArrayBufferWithLimit(response, MAX_MEDIA_BYTES);

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType ?? "application/octet-stream",
        "Content-Length": String(body.byteLength),
        // Private and short-lived: this is authenticated one-shot serving,
        // never a shareable CDN URL for someone else's content.
        "Cache-Control": "private, max-age=300",
        "Content-Disposition": "inline",
        // Defense-in-depth for a PDF served same-origin: browsers must not
        // sniff it as HTML. pdf.js consumes the bytes in a worker anyway.
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const tooLarge =
      error instanceof Error && error.message.includes("exceeds limit");
    logger.warn("Preview media proxy failed", { url, error });
    return new Response(
      tooLarge ? "File too large to preview" : "Preview unavailable",
      { status: tooLarge ? 413 : 500 },
    );
  }
}
