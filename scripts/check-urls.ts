/**
 * URL health checker for Sheltermark bookmarks.
 * Runs as a GitHub Actions cronjob (weekly via check-urls-health.yml).
 *
 * Checks bookmarks for broken links, soft 404s, and server errors.
 *
 * NOTE: This file was moved from .github/scripts/ to scripts/ so that
 * tsconfig include patterns (which skip dot-directories) can pick it up.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { httpFetch, readResponseBody } from "~/lib/utils/http-fetch";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CONCURRENCY = 10;
const TIMEOUT_MS = 10000;
const MAX_RETRIES = 2;
const MAX_BOOKMARKS_PER_RUN = 500;

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

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function isAlwaysAliveDomain(url: string): boolean {
  return ALWAYS_ALIVE_DOMAINS.some((d) => url.includes(d));
}

function getReason(status: number, soft404Reason?: string): string {
  if (soft404Reason) return soft404Reason;
  if (status === 0) return "unknown";
  if (status === 403) return "blocked";
  if (status === 404) return "not_found";
  if (status >= 500) return "server_error";
  if (status >= 400) return "client_error";
  return "unknown";
}

type CheckResult = {
  is_broken: boolean;
  http_status: number;
  reason: string;
  cached?: boolean;
};

/**
 * Fallback to GET request when HEAD returns 403 or 405.
 */
async function retryWithGET(
  url: string,
  retries: number,
): Promise<CheckResult> {
  try {
    const { response } = await httpFetch(url, {
      method: "GET",
      timeout: TIMEOUT_MS,
      retries,
      headers: {
        Accept: "text/html",
      },
    });

    return {
      is_broken: response.status >= 400,
      http_status: response.status,
      reason: "fallback_get",
    };
  } catch {
    return { is_broken: false, http_status: 0, reason: "unknown" };
  }
}

/**
 * Detects soft 404 pages (pages that return 200 but show "not found" content).
 */
async function checkSoft404(url: string): Promise<{
  isSoft404: boolean;
  reason?: string;
}> {
  try {
    const { response } = await httpFetch(url, {
      method: "GET",
      timeout: TIMEOUT_MS,
      retries: 0,
      headers: {
        Range: "bytes=0-8192",
        Accept: "text/html",
        "Accept-Encoding": "gzip, deflate, br",
      },
    });

    let text: string;
    try {
      text = await readResponseBody(response, 8192);
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
      const title = (titleMatch[1] ?? "").trim().toLowerCase();
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
 * Main URL checking function with domain-level caching and soft 404 detection.
 * Uses HEAD request first, falls back to GET for 403/405 responses.
 */
async function checkUrl(
  url: string,
  retries = MAX_RETRIES,
  domainCache: Map<string, CheckResult>,
): Promise<CheckResult> {
  if (isAlwaysAliveDomain(url)) {
    return { is_broken: false, http_status: 200, reason: "always_alive" };
  }

  const domain = getDomain(url);
  const cached = domainCache.get(domain);
  if (cached) {
    return { ...cached, cached: true };
  }

  try {
    const { response } = await httpFetch(url, {
      method: "HEAD",
      timeout: TIMEOUT_MS,
      retries,
      followRedirect: true,
    });

    const status = response.status;

    if (status === 405 || status === 403) {
      const getResult = await retryWithGET(url, retries);
      domainCache.set(domain, getResult);
      return getResult;
    }

    if (status >= 200 && status < 300) {
      const soft404 = await checkSoft404(url);
      if (soft404.isSoft404) {
        const result: CheckResult = {
          is_broken: true,
          http_status: status,
          reason: soft404.reason ?? "soft404",
        };
        domainCache.set(domain, result);
        return result;
      }

      const result: CheckResult = {
        is_broken: false,
        http_status: status,
        reason: "ok",
      };
      domainCache.set(domain, result);
      return result;
    }

    const isBroken = status >= 400 && !VALID_HIGH_STATUS.includes(status);
    const result: CheckResult = {
      is_broken: isBroken,
      http_status: status,
      reason: getReason(status),
    };
    domainCache.set(domain, result);
    return result;
  } catch {
    const result: CheckResult = {
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
 */
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: Promise<T>[] = [];
  const executing = new Set<Promise<void>>();

  for (const task of tasks) {
    const promise = task().then((result) => {
      executing.delete(promise as unknown as Promise<void>);
      return result;
    });

    results.push(promise);
    executing.add(promise as unknown as Promise<void>);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}

async function main(): Promise<void> {
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

  const domainCache = new Map<string, CheckResult>();
  let brokenCount = 0;
  let unknownCount = 0;

  const checks = await runWithConcurrency(
    bookmarks.map(
      (bm: { id: string; url: string; user_id: string }) => async () => {
        const result = await checkUrl(bm.url, MAX_RETRIES, domainCache);
        return { bookmark: bm, ...result };
      },
    ),
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
