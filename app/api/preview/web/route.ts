import type { NextRequest } from "next/server";

import { requireAuthSafe } from "~/lib/auth";
import {
  revalidateInBackground,
  readCached,
  writeCached,
} from "~/lib/preview/cache";
import {
  buildGithubProxyDocument,
  isGithubUrl,
  PROXY_CSP,
} from "~/lib/preview/github-proxy";
import { logger } from "~/lib/utils/logger";

// GitHub native-render proxy (ADR-0007): re-serves GitHub's public HTML from
// our origin inside a script-less sandboxed iframe. GitHub-only by design —
// no arbitrary-URL proxying. The proxy cache is kind='proxy', distinct from
// reader extractions (kind='extract').
export async function GET(req: NextRequest) {
  const { user } = await requireAuthSafe();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return new Response("Missing url", { status: 400 });
  }
  if (!isGithubUrl(url)) {
    return new Response("Proxy unavailable for this site", { status: 403 });
  }

  try {
    const cached = await readCached(url, "proxy", (u) =>
      revalidateInBackground(
        u,
        async (target) => {
          const result = await buildGithubProxyDocument(target);
          return result.ok
            ? {
                status: "ok",
                title: result.title,
                byline: null,
                siteName: "GitHub",
                excerpt: null,
                html: result.html,
                length: result.html.length,
              }
            : {
                status: "empty",
                title: null,
                byline: null,
                siteName: null,
                excerpt: null,
                html: null,
                length: null,
              };
        },
        "proxy",
      ),
    );
    if (cached?.status === "ok" && cached.html) {
      return proxyResponse(cached.html);
    }

    const result = await buildGithubProxyDocument(url);
    if (result.ok) {
      await writeCached(
        url,
        "proxy",
        {
          status: "ok",
          title: result.title,
          byline: null,
          siteName: "GitHub",
          excerpt: null,
          html: result.html,
        },
        result.html.length,
      );
      return proxyResponse(result.html);
    }
    logger.warn("GitHub proxy build failed", {
      url,
      message: `reason: ${result.reason}`,
    });
    return proxyUnavailable();
  } catch (error) {
    logger.error("GitHub proxy route error", { url, error });
    return proxyUnavailable();
  }
}

function proxyResponse(html: string): Response {
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, max-age=300",
      "Content-Security-Policy": PROXY_CSP,
    },
  });
}

// Served inside the preview panel's iframe; a compact script-free document
// with an external link matches the panel's existing fallback behavior.
function proxyUnavailable(): Response {
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Preview unavailable</title>
</head>
<body style="display:flex;min-height:100vh;margin:0;align-items:center;justify-content:center;font:16px/1.6 system-ui,sans-serif;color:#666">
<div style="text-align:center;padding:2rem;max-width:24rem">
<p><strong>Native preview unavailable</strong></p>
<p>This page couldn't be rendered for inline preview.</p>
</div>
</body>
</html>`,
    {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}
