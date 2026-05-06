import dns from "node:dns/promises";
import { isIP } from "node:net";
import { httpFetch, readResponseBody } from "~/lib/utils/http-fetch";
import { getGoogleFavicon, isPrivateIP } from "./utils";

const DNS_TIMEOUT = 3000;
const MAX_HTML_SIZE = 200 * 1024;

export async function isSafeUrl(url: string): Promise<boolean> {
  try {
    const urlObj = new URL(url);
    if (urlObj.protocol !== "https:") return false;

    const hostname = urlObj.hostname;
    if (isIP(hostname)) return !isPrivateIP(hostname);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DNS_TIMEOUT);

    try {
      const lookup = await dns.lookup(hostname);
      clearTimeout(timeout);
      return !isPrivateIP(lookup.address);
    } catch {
      clearTimeout(timeout);
      return false;
    }
  } catch {
    return false;
  }
}

export async function safeFetchHtml(
  url: string,
): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const { response, finalUrl } = await httpFetch(url, {
      followRedirect: { maxHops: 5 },
      onRedirectHop: isSafeUrl,
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.ok) return null;

    const html = await readResponseBody(response, MAX_HTML_SIZE);
    return { html, finalUrl };
  } catch {
    return null;
  }
}

export async function resolveFavicon(
  hostname: string,
  htmlFavicon: string | null,
): Promise<string | null> {
  if (htmlFavicon) return htmlFavicon;

  const rootFavicon = `https://${hostname}/favicon.ico`;
  try {
    const { response } = await httpFetch(rootFavicon, {
      method: "HEAD",
      followRedirect: true,
    });
    if (
      response.ok &&
      response.headers.get("content-type")?.startsWith("image/")
    ) {
      return rootFavicon;
    }
  } catch {
    // fall through to Google
  }

  return getGoogleFavicon(hostname);
}
