import dns from "node:dns/promises";
import { isIP } from "node:net";
import { getGoogleFavicon, isPrivateIP } from "./utils";

export const MAX_REDIRECTS = 5;
export const REQUEST_TIMEOUT = 10000;
export const MAX_HTML_SIZE = 200 * 1024;

const DNS_TIMEOUT = 3000;

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

export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 2,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.status >= 500 || response.status === 429) {
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * 2 ** attempt, 5000);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }

      return response;
    } catch (error) {
      lastError = error as Error;
      if (
        attempt < maxRetries &&
        error instanceof Error &&
        error.name !== "AbortError"
      ) {
        const delay = Math.min(1000 * 2 ** attempt, 5000);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error("Max retries exceeded");
}

export async function readHtmlWithLimit(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      totalBytes += value.length;

      if (totalBytes >= maxBytes) {
        await reader.cancel();
        break;
      }
    }
  } catch {
    // Reader cancelled or error, return what we have
  }

  const combined = new Uint8Array(Math.min(totalBytes, maxBytes));
  let offset = 0;
  for (const chunk of chunks) {
    const remaining = combined.length - offset;
    if (remaining <= 0) break;
    const toCopy = Math.min(chunk.length, remaining);
    combined.set(chunk.subarray(0, toCopy), offset);
    offset += toCopy;
  }

  return new TextDecoder().decode(combined);
}

export async function safeFetchHtml(
  url: string,
): Promise<{ html: string; finalUrl: string } | null> {
  let currentUrl = url;
  let redirectCount = 0;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  while (redirectCount <= MAX_REDIRECTS) {
    try {
      const response = await fetchWithRetry(currentUrl, {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "User-Agent": "Sheltermark/1.0",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      const locationHeader = response.headers.get("location");
      if (response.status >= 300 && response.status < 400 && locationHeader) {
        redirectCount++;
        const location = locationHeader;
        const newUrl = new URL(location, currentUrl).toString();

        const isSafe = await isSafeUrl(newUrl);
        if (!isSafe) {
          throw new Error(`Redirect to unsafe URL blocked: ${newUrl}`);
        }

        currentUrl = newUrl;
        continue;
      }

      clearTimeout(timeout);

      if (!response.ok) return null;

      const html = await readHtmlWithLimit(response, MAX_HTML_SIZE);
      return { html, finalUrl: currentUrl };
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  clearTimeout(timeout);
  throw new Error(`Too many redirects (max ${MAX_REDIRECTS})`);
}

export async function resolveFavicon(
  hostname: string,
  htmlFavicon: string | null,
): Promise<string | null> {
  if (htmlFavicon) return htmlFavicon;

  const rootFavicon = `https://${hostname}/favicon.ico`;
  try {
    const res = await fetch(rootFavicon, {
      method: "HEAD",
      redirect: "follow",
    });
    if (res.ok && res.headers.get("content-type")?.startsWith("image/")) {
      return rootFavicon;
    }
  } catch {
    // fall through to Google
  }

  return getGoogleFavicon(hostname);
}
