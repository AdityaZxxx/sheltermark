/**
 * Shared HTTP fetching module for Sheltermark.
 *
 * Consolidates duplicated fetch logic previously scattered across:
 * - lib/metadata/utils.ts (fetchWithTimeout)
 * - lib/metadata/fetch.ts   (fetchWithRetry)
 * - .github/scripts/check-urls.js (fetchWithTimeout)
 *
 * Design decisions (see docs/adr/):
 * - Retry happens inside the helper (not at caller)
 * - Timeouts are retried (not fast-fail)
 * - Single User-Agent ("Sheltermark/1.0") for all requests
 * - Configurable redirect: auto-follow, manual with hop validation, or none
 * - Retry is per-hop when following redirects manually
 */

const DEFAULT_TIMEOUT = 10_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_USER_AGENT = "Sheltermark/1.0";
const DEFAULT_MAX_HOPS = 5;
const DEFAULT_RETRY_STATUSES = [429, 500, 502, 503];

type HttpFetchOptions = {
  method?: "GET" | "HEAD" | "POST";
  /** Request timeout in ms (default: 10_000). */
  timeout?: number;
  /** Max retry attempts (default: 2). Applies per redirect hop. */
  retries?: number;
  /** HTTP status codes that trigger a retry (default: [429, 500, 502, 503]). */
  retryOnStatus?: number[];
  /** Additional request headers. User-Agent is set automatically. */
  headers?: Record<string, string>;
  /** Override default User-Agent (default: "Sheltermark/1.0"). */
  userAgent?: string;
  /**
   * Redirect behaviour:
   * - `true` or omitted: auto-follow via native fetch (response.url = final URL).
   * - `false`: don't follow (return 3xx as-is).
   * - `{ maxHops?: number }`: manual follow with optional onRedirectHop validation.
   */
  followRedirect?: boolean | { maxHops?: number };
  /**
   * Per-hop URL validator for manual redirect mode.
   * Return `false` to abort (throws "Redirect to unsafe URL blocked").
   */
  onRedirectHop?: (url: string) => Promise<boolean>;
  /** External abort signal. When aborted, stops retrying immediately. */
  signal?: AbortSignal;
};

type HttpFetchResult = {
  response: Response;
  /** Resolved URL after all redirects (or original URL if not redirected). */
  finalUrl: string;
  /** Total elapsed time in ms. */
  duration: number;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Single fetch with timeout and external signal support.
 * Retry is NOT handled here — that's in attemptWithRetry.
 */
async function executeWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
  externalSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const onExternalAbort = () => {
    clearTimeout(timeoutId);
    controller.abort(externalSignal?.reason);
  };
  externalSignal?.addEventListener("abort", onExternalAbort, { once: true });

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }
}

/**
 * fetch with retry + exponential backoff.
 * Retries on retryOnStatus codes AND transient network errors (AbortError included).
 * Stops retrying if the external signal fires (caller-initiated abort).
 */
async function attemptWithRetry(
  url: string,
  options: RequestInit,
  retries: number,
  retryOnStatus: number[],
  timeoutMs: number,
  externalSignal?: AbortSignal,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (externalSignal?.aborted) {
      throw externalAbortError();
    }

    try {
      const response = await executeWithTimeout(
        url,
        options,
        timeoutMs,
        externalSignal,
      );

      if (attempt < retries && retryOnStatus.includes(response.status)) {
        const delay = Math.min(1000 * 2 ** attempt, 5000);
        await sleep(delay);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error as Error;
      if (attempt < retries && !externalSignal?.aborted) {
        const delay = Math.min(1000 * 2 ** attempt, 5000);
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }

  throw lastError ?? new Error("Max retries exceeded");
}

/**
 * Follow redirects manually with per-hop validation and retry.
 * Each hop gets its own retry cycle — a failed hop retries that hop, not the chain.
 */
async function followRedirectsManually(
  url: string,
  options: RequestInit,
  retries: number,
  retryOnStatus: number[],
  timeoutMs: number,
  maxHops: number,
  externalSignal?: AbortSignal,
  onRedirectHop?: (url: string) => Promise<boolean>,
): Promise<{ response: Response; finalUrl: string }> {
  const manualOptions: RequestInit = { ...options, redirect: "manual" };
  let currentUrl = url;
  let hops = 0;

  while (hops <= maxHops) {
    if (externalSignal?.aborted) {
      throw externalAbortError();
    }

    const response = await attemptWithRetry(
      currentUrl,
      manualOptions,
      retries,
      retryOnStatus,
      timeoutMs,
      externalSignal,
    );

    const status = response.status;
    const location = response.headers.get("location");

    if (status >= 300 && status < 400 && location) {
      hops++;
      const nextUrl = new URL(location, currentUrl).toString();

      if (onRedirectHop) {
        const allowed = await onRedirectHop(nextUrl);
        if (!allowed) {
          throw new Error(`Redirect to unsafe URL blocked: ${nextUrl}`);
        }
      }

      currentUrl = nextUrl;
      continue;
    }

    return { response, finalUrl: currentUrl };
  }

  throw new Error(`Too many redirects (max ${maxHops})`);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Fetch a URL with configurable timeout, retries, and redirect handling.
 *
 * @example
 * ```ts
 * // Simple GET (auto-follow)
 * const { response, finalUrl } = await httpFetch("https://example.com");
 *
 * // HEAD with retry, no redirect
 * const { response } = await httpFetch("https://example.com", {
 *   method: "HEAD",
 *   followRedirect: false,
 * });
 *
 * // Manual redirects with security validation
 * const { response, finalUrl, duration } = await httpFetch(url, {
 *   followRedirect: { maxHops: 5 },
 *   onRedirectHop: async (hopUrl) => isSafeUrl(hopUrl),
 * });
 * ```
 */
export async function httpFetch(
  url: string,
  opts?: HttpFetchOptions,
): Promise<HttpFetchResult> {
  const timeout = opts?.timeout ?? DEFAULT_TIMEOUT;
  const retries = opts?.retries ?? DEFAULT_RETRIES;
  const retryOnStatus = opts?.retryOnStatus ?? DEFAULT_RETRY_STATUSES;
  const userAgent = opts?.userAgent ?? DEFAULT_USER_AGENT;

  const headers: Record<string, string> = {
    "User-Agent": userAgent,
    ...opts?.headers,
  };

  const baseOptions: RequestInit = {
    method: opts?.method ?? "GET",
    headers,
  };

  const startTime = performance.now();
  const redirectConfig = opts?.followRedirect;

  // --- Auto-follow via native fetch ---
  if (redirectConfig === undefined || redirectConfig === true) {
    baseOptions.redirect = "follow";
    const response = await attemptWithRetry(
      url,
      baseOptions,
      retries,
      retryOnStatus,
      timeout,
      opts?.signal,
    );
    return {
      response,
      finalUrl: response.url,
      duration: Math.round(performance.now() - startTime),
    };
  }

  // --- No redirect following ---
  if (redirectConfig === false) {
    baseOptions.redirect = "manual";
    const response = await attemptWithRetry(
      url,
      baseOptions,
      retries,
      retryOnStatus,
      timeout,
      opts?.signal,
    );
    return {
      response,
      finalUrl: url,
      duration: Math.round(performance.now() - startTime),
    };
  }

  // --- Manual redirect following with hop validation ---
  const maxHops = redirectConfig.maxHops ?? DEFAULT_MAX_HOPS;
  const { response, finalUrl } = await followRedirectsManually(
    url,
    baseOptions,
    retries,
    retryOnStatus,
    timeout,
    maxHops,
    opts?.signal,
    opts?.onRedirectHop,
  );

  return {
    response,
    finalUrl,
    duration: Math.round(performance.now() - startTime),
  };
}

// ---------------------------------------------------------------------------
// Companion utilities
// ---------------------------------------------------------------------------

/**
 * Read a response body with an optional byte limit.
 * When `maxBytes` is set, the stream is cancelled after the limit is reached
 * to avoid downloading large payloads unnecessarily.
 *
 * @example
 * ```ts
 * const { response } = await httpFetch("https://example.com");
 * const html = await readResponseBody(response, 200_000); // max 200KB
 * ```
 */
export async function readResponseBody(
  response: Response,
  maxBytes?: number,
): Promise<string> {
  if (!maxBytes || maxBytes <= 0) {
    return response.text();
  }
  return readStreamWithLimit(response, maxBytes);
}

// ---------------------------------------------------------------------------
// Internal utilities
// ---------------------------------------------------------------------------

function externalAbortError(): Error {
  const err = new Error("The operation was aborted");
  err.name = "AbortError";
  return err;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readStreamWithLimit(
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
    // Reader was cancelled or errored — return what we have
  }

  const size = Math.min(totalBytes, maxBytes);
  const combined = new Uint8Array(size);
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
