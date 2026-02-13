import dns from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Validates if an IP address is private or reserved
 */
function isPrivateIP(ip: string): boolean {
  // IPv4 checks
  const ipv4Match = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4Match) {
    const [, p1, p2] = ipv4Match.map(Number);
    if (p1 === 10) return true; // 10.0.0.0/8
    if (p1 === 127) return true; // 127.0.0.0/8
    if (p1 === 169 && p2 === 254) return true; // 169.254.0.0/16
    if (p1 === 172 && p2 >= 16 && p2 <= 31) return true; // 172.16.0.0/12
    if (p1 === 192 && p2 === 168) return true; // 192.168.0.0/16
    if (p1 === 0) return true; // 0.0.0.0/8
    if (p1 >= 224) return true; // Multicast/Reserved
  }

  // IPv6 checks
  const ipLower = ip.toLowerCase();
  if (
    ipLower === "::1" ||
    ipLower === "::" ||
    ipLower.startsWith("fe80:") || // link-local
    ipLower.startsWith("fc00:") || // unique local
    ipLower.startsWith("fd00:") || // unique local
    ipLower.startsWith("ff00:") // multicast
  ) {
    return true;
  }

  return false;
}

/**
 * Validates if a URL is safe for server-side fetching (SSRF protection)
 */
async function isSafeUrl(url: string): Promise<boolean> {
  try {
    const urlObj = new URL(url);

    // 1. Enforce allowed schemes (only https)
    if (urlObj.protocol !== "https:") return false;

    const hostname = urlObj.hostname;

    // 2. Check if hostname is an IP and if it's private
    if (isIP(hostname)) {
      return !isPrivateIP(hostname);
    }

    // 3. Resolve hostname to IP and check if it's private
    // Using a timeout to prevent DNS hang
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

/**
 * Fetch with retry logic and exponential backoff.
 * Retries on 5xx errors, 429 (rate limit), and network failures.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 2,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Retry on server errors and rate limits
      if (response.status >= 500 || response.status === 429) {
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * 2 ** attempt, 5000); // 1s, 2s, max 5s
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }

      return response;
    } catch (error) {
      lastError = error as Error;
      // Don't retry on timeout/abort, but retry on network failures
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

export type Metadata = {
  title: string;
  og_image_url: string | null;
  favicon_url: string | null;
  description: string | null;
};

/**
 * Fallback to external API (Microlink) for difficult sites
 */
async function fetchMetadataViaMicrolink(
  url: string,
): Promise<Metadata | null> {
  try {
    // Use Microlink API (free tier: 50 requests/day)
    const apiUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}`;
    const response = await fetch(apiUrl, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.status || data.status !== "success") return null;

    return {
      title: data.data?.title || url,
      og_image_url: data.data?.image?.url || null,
      favicon_url: data.data?.logo?.url || null,
      description: data.data?.description || null,
    };
  } catch (error) {
    console.error("Microlink fallback failed:", error);
    return null;
  }
}

export async function fetchMetadata(url: string): Promise<Metadata> {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // 1. SSRF Check
    const isSafe = await isSafeUrl(url);
    if (!isSafe) {
      return {
        title: url,
        og_image_url: null,
        favicon_url: `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`,
        description: null,
      };
    }

    // 2. Special handling for Twitter/X using fxtwitter (Unlimited & Fast)
    if (hostname.endsWith("twitter.com") || hostname.endsWith("x.com")) {
      try {
        // Construct fxtwitter URL
        // e.g. https://x.com/user/status/123 -> https://api.fxtwitter.com/user/status/123
        const apiPath = urlObj.pathname;
        const apiUrl = `https://api.fxtwitter.com${apiPath}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        // Use a bot UA to ensure we get the JSON response or proper meta if we were scraping
        // But fxtwitter API returns JSON directly.
        const response = await fetch(apiUrl, {
          signal: controller.signal,
          headers: { "User-Agent": "Sheltermark/1.0" },
        });
        clearTimeout(timeout);

        if (response.ok) {
          const data = await response.json();
          // Handle Tweet
          if (data.tweet) {
            return {
              title: `${data.tweet.author.name} on X: "${data.tweet.text.substring(0, 50)}..."`,
              description: data.tweet.text,
              og_image_url:
                data.tweet.media?.photos?.[0]?.url ||
                data.tweet.author.avatar_url,
              favicon_url: data.tweet.author.avatar_url,
            };
          }
          // Handle Profile
          if (data.user) {
            return {
              title: `${data.user.name} (@${data.user.screen_name}) / X`,
              description: data.user.description,
              og_image_url: data.user.avatar_url?.replace("_normal", ""), // Get high res
              favicon_url: data.user.avatar_url,
            };
          }
        }
      } catch (e) {
        console.error(
          "Twitter API fetch failed, falling back to standard scrape",
          e,
        );
      }
    }

    // 3. JS-Heavy Check (Instagram, Facebook) -> Use Microlink immediately
    // These sites are notoriously hard to scrape without headless browsers/APIs
    if (
      hostname.endsWith("instagram.com") ||
      hostname.endsWith("facebook.com")
    ) {
      const microResult = await fetchMetadataViaMicrolink(url);
      if (microResult) return microResult;
    }

    // 4. Standard Fetch (Waterfall with Cheerio)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    let response: Response;
    try {
      response = await fetchWithRetry(
        url,
        {
          signal: controller.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          },
        },
        2, // Max retries
      );
    } catch (e) {
      clearTimeout(timeout);
      // If standard fetch fails, try Microlink as last resort
      console.warn(
        `Standard fetch failed for ${url}, trying Microlink fallback...`,
      );
      const microResult = await fetchMetadataViaMicrolink(url);
      if (microResult) return microResult;
      throw e;
    }

    clearTimeout(timeout);

    if (!response.ok) {
      // If status is bad (e.g. 403 Forbidden), try Microlink
      console.warn(
        `Standard fetch status ${response.status} for ${url}, trying Microlink fallback...`,
      );
      const microResult = await fetchMetadataViaMicrolink(url);
      if (microResult) return microResult;

      // If fallback also fails, return basic info
      return {
        title: url,
        og_image_url: null,
        favicon_url: `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`,
        description: null,
      };
    }

    const html = await response.text();

    // Dynamic import for performance
    const { load } = await import("cheerio");
    const $ = load(html);

    // Helper to get content from meta tags
    const getMeta = (selectors: string[]): string | null => {
      for (const selector of selectors) {
        const el = $(selector);
        const content = el.attr("content") || el.attr("href") || el.text();
        if (content) return content;
      }
      return null;
    };

    // Extract Metadata (Waterfall strategy)

    // Title
    const title =
      getMeta([
        'meta[property="og:title"]',
        'meta[name="twitter:title"]',
        "title",
      ]) || new URL(url).hostname;

    // Description
    const description = getMeta([
      'meta[property="og:description"]',
      'meta[name="twitter:description"]',
      'meta[name="description"]',
    ]);

    // Image
    let ogImage = getMeta([
      'meta[property="og:image"]',
      'meta[name="twitter:image"]',
      'link[rel="image_src"]',
      'meta[itemprop="image"]',
    ]);

    // Favicon
    let favicon = getMeta([
      'link[rel="apple-touch-icon"]',
      'link[rel="icon"]',
      'link[rel="shortcut icon"]',
      'link[rel="mask-icon"]',
    ]);

    // Normalize URLs (handle relative paths)
    const resolveUrl = (path: string | null) => {
      if (!path) return null;
      try {
        return new URL(path, url).toString();
      } catch {
        return null;
      }
    };

    ogImage = resolveUrl(ogImage);
    favicon = resolveUrl(favicon);

    // 6. Fallback for Favicon (Google S2)
    if (!favicon) {
      try {
        favicon = `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
      } catch {
        // invalid url, keep null
      }
    }

    // 7. Last check: if we barely got anything, try Microlink?
    // Usually if we got HTML but no tags, Microlink might do better if it uses a headless browser
    if (title === hostname && !ogImage) {
      const microResult = await fetchMetadataViaMicrolink(url);
      if (microResult && microResult.title !== url) return microResult;
    }

    return {
      title: title.trim(),
      og_image_url: ogImage,
      favicon_url: favicon,
      description: description?.trim() || null,
    };
  } catch (error) {
    console.error("Metadata fetch error:", error);

    // Final fallback attempt
    const microResult = await fetchMetadataViaMicrolink(url);
    if (microResult) return microResult;

    let fallbackHostname = url;
    try {
      fallbackHostname = new URL(url).hostname;
    } catch {
      // invalid url, keep original
    }

    return {
      title: url,
      og_image_url: null,
      favicon_url: `https://www.google.com/s2/favicons?domain=${fallbackHostname}&sz=128`,
      description: null,
    };
  }
}
