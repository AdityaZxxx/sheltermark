import dns from "node:dns/promises";
import { isIP } from "node:net";

export type Metadata = {
  title: string;
  og_image_url: string | null;
  favicon_url: string | null;
};

const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT = 10000;
const MAX_HTML_SIZE = 200 * 1024; // 200KB

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&#x27;": "'",
  "&#x2F;": "/",
  "&nbsp;": " ",
  "&mdash;": "—",
  "&ndash;": "–",
  "&hellip;": "…",
  "&copy;": "©",
  "&reg;": "®",
  "&trade;": "™",
};

function decodeHtmlEntities(text: string): string {
  let decoded = text;
  for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
    decoded = decoded.split(entity).join(char);
  }
  decoded = decoded.replace(/&#(\d+);/g, (_, code) =>
    String.fromCharCode(Number.parseInt(code, 10)),
  );
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_, code) =>
    String.fromCharCode(Number.parseInt(code, 16)),
  );
  return decoded;
}

function resolveUrl(path: string | null, baseUrl: string): string | null {
  if (!path) return null;
  try {
    return new URL(path, baseUrl).toString();
  } catch {
    return null;
  }
}

function getGoogleFavicon(hostname: string): string {
  return `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
}

function isPrivateIP(ip: string): boolean {
  const ipv4Match = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4Match) {
    const [, p1, p2] = ipv4Match.map(Number);
    if (p1 === 10) return true;
    if (p1 === 127) return true;
    if (p1 === 169 && p2 === 254) return true;
    if (p1 === 172 && p2 >= 16 && p2 <= 31) return true;
    if (p1 === 192 && p2 === 168) return true;
    if (p1 === 0) return true;
    if (p1 >= 224) return true;
  }

  const ipLower = ip.toLowerCase();
  if (
    ipLower === "::1" ||
    ipLower === "::" ||
    ipLower.startsWith("fe80:") ||
    ipLower.startsWith("fc00:") ||
    ipLower.startsWith("fd00:") ||
    ipLower.startsWith("ff00:")
  ) {
    return true;
  }

  return false;
}

async function isSafeUrl(url: string): Promise<boolean> {
  try {
    const urlObj = new URL(url);
    if (urlObj.protocol !== "https:") return false;

    const hostname = urlObj.hostname;
    if (isIP(hostname)) return !isPrivateIP(hostname);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

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

async function fetchWithRetry(
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

async function readHtmlWithLimit(
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

async function safeFetchHtml(
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

      if (
        response.status >= 300 &&
        response.status < 400 &&
        response.headers.get("location")
      ) {
        redirectCount++;
        // biome-ignore lint/style/noNonNullAssertion: because of the check above, this is guaranteed to be defined
        const location = response.headers.get("location")!;
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

function extractMetadataFromHtml(
  html: string,
  baseUrl: string,
): Omit<Metadata, "favicon_url"> & { favicon_url: string | null } {
  const { load } = require("cheerio");
  const $ = load(html);

  const getMeta = (selectors: string[]): string | null => {
    for (const selector of selectors) {
      const el = $(selector);
      const content = el.attr("content") || el.attr("href") || el.text();
      if (content) return content;
    }
    return null;
  };

  const title =
    getMeta([
      'meta[property="og:title"]',
      'meta[name="twitter:title"]',
      'meta[name="title"]',
      "title",
    ]) || new URL(baseUrl).hostname;

  const ogImage = resolveUrl(
    getMeta([
      'meta[property="og:image"]',
      'meta[name="twitter:image"]',
      'link[rel="image_src"]',
      'meta[itemprop="image"]',
    ]),
    baseUrl,
  );

  const favicon = resolveUrl(
    getMeta([
      'link[rel="apple-touch-icon"]',
      'link[rel="icon"]',
      'link[rel="shortcut icon"]',
      'link[rel="mask-icon"]',
    ]),
    baseUrl,
  );

  return {
    title: decodeHtmlEntities(title.trim()),
    og_image_url: ogImage,
    favicon_url: favicon,
  };
}

async function fetchViaMicrolink(url: string): Promise<Metadata | null> {
  try {
    const apiUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}`;
    const response = await fetch(apiUrl, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.status || data.status !== "success") return null;

    return {
      title: decodeHtmlEntities(data.data?.title || url),
      og_image_url: data.data?.image?.url || null,
      favicon_url: data.data?.logo?.url || null,
    };
  } catch {
    return null;
  }
}

async function fetchTwitterMetadata(url: string): Promise<Metadata | null> {
  try {
    const urlObj = new URL(url);
    const apiPath = urlObj.pathname;
    const apiUrl = `https://api.fxtwitter.com${apiPath}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Sheltermark/1.0" },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = await response.json();
    if (data.tweet) {
      return {
        title: `${data.tweet.author.name} on X: "${data.tweet.text.substring(0, 50)}..."`,
        og_image_url:
          data.tweet.media?.photos?.[0]?.url || data.tweet.author.avatar_url,
        favicon_url: data.tweet.author.avatar_url,
      };
    }
    if (data.user) {
      return {
        title: `${data.user.name} (@${data.user.screen_name}) / X`,
        og_image_url: data.user.avatar_url?.replace("_normal", ""),
        favicon_url: data.user.avatar_url,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function isTwitterUrl(hostname: string): boolean {
  return (
    hostname === "twitter.com" ||
    hostname.endsWith(".twitter.com") ||
    hostname === "x.com" ||
    hostname.endsWith(".x.com")
  );
}

function isJsHeavySite(hostname: string): boolean {
  return (
    hostname === "instagram.com" ||
    hostname.endsWith(".instagram.com") ||
    hostname === "facebook.com" ||
    hostname.endsWith(".facebook.com")
  );
}

async function fallbackStrategy(
  url: string,
  hostname: string,
): Promise<Metadata | null> {
  if (isTwitterUrl(hostname)) {
    const result = await fetchTwitterMetadata(url);
    if (result) return result;
  }

  if (isJsHeavySite(hostname)) {
    const result = await fetchViaMicrolink(url);
    if (result) return result;
  }

  return null;
}

function createBasicMetadata(url: string, hostname: string): Metadata {
  return {
    title: url,
    og_image_url: null,
    favicon_url: getGoogleFavicon(hostname),
  };
}

export async function fetchMetadata(url: string): Promise<Metadata> {
  const urlObj = new URL(url);
  const hostname = urlObj.hostname;

  const isSafe = await isSafeUrl(url);
  if (!isSafe) {
    return createBasicMetadata(url, hostname);
  }

  const fallbackResult = await fallbackStrategy(url, hostname);
  if (fallbackResult) return fallbackResult;

  try {
    const fetchResult = await safeFetchHtml(url);
    if (!fetchResult) {
      const microlinkResult = await fetchViaMicrolink(url);
      if (microlinkResult) return microlinkResult;
      return createBasicMetadata(url, hostname);
    }

    const { html, finalUrl } = fetchResult;
    const metadata = extractMetadataFromHtml(html, finalUrl);

    if (metadata.title === hostname && !metadata.og_image_url) {
      const microlinkResult = await fetchViaMicrolink(url);
      if (microlinkResult && microlinkResult.title !== url) {
        return microlinkResult;
      }
    }

    return {
      ...metadata,
      favicon_url: metadata.favicon_url || getGoogleFavicon(hostname),
    };
  } catch {
    const microlinkResult = await fetchViaMicrolink(url);
    if (microlinkResult) return microlinkResult;
    return createBasicMetadata(url, hostname);
  }
}
