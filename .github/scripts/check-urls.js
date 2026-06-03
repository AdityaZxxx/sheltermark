/**
 * @fileoverview URL health checker for Sheltermark bookmarks.
 * Checks bookmarks for broken links, soft 404s, and server errors.
 * @module check-urls
 */

require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CONCURRENCY = 10;
const TIMEOUT_MS = 10000;
const MAX_RETRIES = 2;
const MAX_BOOKMARKS_PER_RUN = 500;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const ALWAYS_ALIVE_DOMAINS = [
  "twitter.com",
  "x.com",
  "nitter.net",
  "youtube.com",
  "youtu.be",
  "instagram.com",
  "tiktok.com",
  "facebook.com",
  "fb.com",
];

const VALID_HIGH_STATUS = [410, 451];

const SOFT_404_KEYWORDS = [
  "page not found",
  "doesn't exist",
  "not available",
  "content not found",
  "this page doesn't exist",
  "this content doesn't exist",
];

/**
 * Extracts the hostname from a URL.
 * @param {string} url - The URL to parse.
 * @returns {string} The hostname or the original string if parsing fails.
 */
function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * Checks if a URL belongs to a domain known to always be alive (social media, etc.).
 * @param {string} url - The URL to check.
 * @returns {boolean} True if the domain is in the always-alive list.
 */
function isAlwaysAliveDomain(url) {
  return ALWAYS_ALIVE_DOMAINS.some((d) => url.includes(d));
}

/**
 * Determines the reason string based on HTTP status code.
 * @param {number} status - The HTTP status code.
 * @param {string} [soft404Reason] - Optional soft404 reason override.
 * @returns {string} The reason string (e.g., "blocked", "not_found", "server_error").
 */
function getReason(status, soft404Reason) {
  if (soft404Reason) return soft404Reason;
  if (status === 0) return "unknown";
  if (status === 403) return "blocked";
  if (status === 404) return "not_found";
  if (status >= 500) return "server_error";
  if (status >= 400) return "client_error";
  return "unknown";
}

/**
 * Promise-based delay.
 * @param {number} ms - Milliseconds to sleep.
 * @returns {Promise<void>}
 */
async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches a URL with an AbortController timeout.
 * @param {string} url - The URL to fetch.
 * @param {RequestInit} options - Fetch options.
 * @param {number} [timeout=TIMEOUT_MS] - Timeout in milliseconds.
 * @returns {Promise<Response>} The fetch Response object.
 * @throws {Error} If the request times out or fails.
 */
async function fetchWithTimeout(url, options, timeout = TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Fallback to GET request when HEAD returns 403 or 405.
 * Retries with exponential backoff on failure.
 * @param {string} url - The URL to fetch.
 * @param {number} retries - Number of retry attempts remaining.
 * @returns {Promise<{is_broken: boolean, http_status: number, reason: string}>}
 */
async function retryWithGET(url, retries) {
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html",
        },
      },
      TIMEOUT_MS,
    );

    return {
      is_broken: res.status >= 400,
      http_status: res.status,
      reason: "fallback_get",
    };
  } catch {
    if (retries > 0) {
      await sleep(2000);
      return retryWithGET(url, retries - 1);
    }
    return { is_broken: false, http_status: 0, reason: "unknown" };
  }
}

/**
 * Detects soft 404 pages (pages that return 200 but show "not found" content).
 * Checks page size (< 2000 chars) and presence of 404-related keywords or titles.
 * @param {string} url - The URL to check.
 * @returns {Promise<{isSoft404: boolean, reason?: string}>}
 */
async function checkSoft404(url) {
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: "GET",
        headers: {
          "User-Agent": USER_AGENT,
          Range: "bytes=0-8192",
          Accept: "text/html",
          "Accept-Encoding": "gzip, deflate, br",
        },
      },
      TIMEOUT_MS,
    );

    let text;
    try {
      text = await res.text();
    } catch {
      return { isSoft404: false };
    }

    if (text.length < 2000) {
      const lower = text.toLowerCase();
      const isSoft404 = SOFT_404_KEYWORDS.some((k) => lower.includes(k));

      if (isSoft404) {
        return { isSoft404: true, reason: "soft404" };
      }
    }

    const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      const title = titleMatch[1].trim().toLowerCase();
      if (
        title.includes("404") ||
        title === "not found" ||
        title === "page not found"
      ) {
        return { isSoft404: true, reason: "title_404" };
      }
    }

    return { isSoft404: false };
  } catch {
    return { isSoft404: false };
  }
}

/**
 * Main URL checking function with caching and soft 404 detection.
 * Uses HEAD request first, falls back to GET for 403/405 responses.
 * @param {string} url - The URL to check.
 * @param {number} [retries=MAX_RETRIES] - Number of retry attempts.
 * @param {Map<string, object>} domainCache - Domain-level result cache.
 * @returns {Promise<{is_broken: boolean, http_status: number, reason: string, cached?: boolean}>}
 */
async function checkUrl(url, retries = MAX_RETRIES, domainCache) {
  if (isAlwaysAliveDomain(url)) {
    return { is_broken: false, http_status: 200, reason: "always_alive" };
  }

  const domain = getDomain(url);
  if (domainCache.has(domain)) {
    const cached = domainCache.get(domain);
    return { ...cached, cached: true };
  }

  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: "HEAD",
        redirect: "follow",
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,*/*",
        },
      },
      TIMEOUT_MS,
    );

    const status = res.status;

    if (status === 405 || status === 403) {
      const getResult = await retryWithGET(url, retries);
      domainCache.set(domain, getResult);
      return getResult;
    }

    if (status >= 200 && status < 300) {
      const soft404 = await checkSoft404(url);
      if (soft404.isSoft404) {
        const result = {
          is_broken: true,
          http_status: status,
          reason: soft404.reason,
        };
        domainCache.set(domain, result);
        return result;
      }

      const result = {
        is_broken: false,
        http_status: status,
        reason: "ok",
      };
      domainCache.set(domain, result);
      return result;
    }

    const isBroken = status >= 400 && !VALID_HIGH_STATUS.includes(status);

    const result = {
      is_broken: isBroken,
      http_status: status,
      reason: getReason(status),
    };
    domainCache.set(domain, result);
    return result;
  } catch (error) {
    if (retries > 0 && error.name === "AbortError") {
      await sleep(2000);
      return checkUrl(url, retries - 1, domainCache);
    }

    const result = {
      is_broken: false,
      http_status: 0,
      reason: "unknown",
    };
    domainCache.set(domain, result);
    return result;
  }
}

/**
 * Executes an array of async tasks with a concurrency limit.
 * @template T
 * @param {Array<() => Promise<T>>} tasks - Array of task functions.
 * @param {number} limit - Maximum concurrent tasks.
 * @returns {Promise<T[]>} Array of results in the same order as input tasks.
 */
async function runWithConcurrency(tasks, limit) {
  const results = [];
  const executing = new Set();

  for (const task of tasks) {
    const promise = task().then((result) => {
      executing.delete(promise);
      return result;
    });

    results.push(promise);
    executing.add(promise);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}

/**
 * Main entry point. Fetches bookmarks with auto_check_broken enabled,
 * checks each URL concurrently, and updates the database.
 */
async function main() {
  console.log("Starting URL health check...");

  const { data: bookmarks, error } = await supabase
    .from("bookmarks")
    .select("id, url, user_id, workspaces!inner(auto_check_broken)")
    .eq("workspaces.auto_check_broken", true)
    .or(
      "last_checked_at.is.null,last_checked_at.lt." +
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    )
    .limit(MAX_BOOKMARKS_PER_RUN);

  if (error) {
    console.error("Fetch error:", error);
    process.exit(1);
  }

  if (!bookmarks?.length) {
    console.log("No bookmarks need checking");
    return;
  }

  console.log(`Checking ${bookmarks.length} bookmarks`);

  const domainCache = new Map();
  let brokenCount = 0;
  let unknownCount = 0;

  const checks = await runWithConcurrency(
    bookmarks.map((bm) => async () => {
      const result = await checkUrl(bm.url, MAX_RETRIES, domainCache);
      return { bookmark: bm, ...result };
    }),
    CONCURRENCY,
  );

  let updatedCount = 0;

  for (const check of checks) {
    const { bookmark, is_broken, http_status, reason } = check;

    if (is_broken) {
      brokenCount++;
    } else if (reason === "unknown") {
      unknownCount++;
    }

    const { error: updateError } = await supabase
      .from("bookmarks")
      .update({
        is_broken,
        http_status,
        last_checked_at: new Date().toISOString(),
      })
      .eq("id", bookmark.id)
      .eq("user_id", bookmark.user_id);

    if (updateError) {
      console.error(`Update failed for ${bookmark.id}:`, updateError.message);
    } else {
      updatedCount++;
    }
  }

  console.log(
    `Done. Checked: ${bookmarks.length}, Updated: ${updatedCount}, Broken: ${brokenCount}, Unknown: ${unknownCount}`,
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
