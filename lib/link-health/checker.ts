import { logger } from "~/lib/logger";
import { httpFetch, readResponseBody } from "~/lib/utils/http-fetch";

/**
 * URL Health Checker — Link Health context.
 *
 * Three responsibilities, decomposed to make each independently testable:
 *
 *   1. Pure classification: given an HTTP status or fetch error, decide
 *      whether a link is broken, alive, or unknown.
 *
 *   2. Soft-404 heuristic: detect pages that returned 200 but are
 *      functionally not-found. Uses precision tiers (high-precision
 *      structural signals fire regardless of body size; the combined
 *      keyword+title signal is short-body gated; the old noisy
 *      singleton branches were removed).
 *
 *   3. The orchestrator `checkUrl` that combines a HEAD-then-GET attempt
 *      with classification.
 *
 * All errors are categorised rather than collapsed. The previous design
 * lumped every thrown fetch into `is_broken: false`. That made every
 * timeout look like a healthy link and was a major source of false claims.
 *
 * The previous design also cached check results *per domain* across URLs.
 * A single broken path therefore poisoned every other path on the same
 * domain. This module does no such caching. Hosts that are clearly
 * reachable (e.g. an HTTP/1.1 200) aren't reused for any other URL
 * because a domain is not a path; the same host can serve 200 for one
 * URL and 404 for another.
 *
 * ## HTTP classification semantics
 *
 * The status-code → BrokenStatus mapping follows HTTP RFC semantics
 * (RFC 9110 / RFC 6585). Server-side and transient failures (5xx, 408,
 * 425, 429) are classified `unknown`, not `confirmed_broken` — a 503
 * maintenance window or a 429 rate-limit response does not mean the
 * resource is gone. See docs/broken-link-detection-design-review.md §2
 * for the full rationale and RFC citations.
 *
 * ## GET-primary vs HEAD-with-fallback
 *
 * The design review (§2 R-I) evaluated switching to GET-primary (lychee's
 * approach) to eliminate the HEAD→GET fallback machinery and make the
 * soft-404 probe a no-op. Decision: **keep HEAD-with-fallback** for now.
 * The HTTP classification fixes and tiered soft-404 deliver the bulk of
 * the FP/FN reduction without the migration risk. GET-primary remains a
 * candidate for a future dedicated refactor — it would simplify the code
 * (~80 lines removed) and fix R-J (finalUrl discarded by the probe), but
 * the current approach is stable, well-tested, and the bandwidth cost
 * (HEAD ~0.5KB vs GET ~50KB per check) matters for a weekly cron over
 * up to 500 bookmarks per run.
 */

export type BrokenStatus =
  | "alive"
  | "confirmed_broken"
  | "likely_broken"
  | "unknown";

export interface UrlHealthResult {
  brokenStatus: BrokenStatus;
  /** Derived boolean kept for backwards compat with `is_broken` column. */
  isBroken: boolean;
  httpStatus: number | null;
  reason: string;
}

const TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;

/**
 * Domains known to wall off automated checks with bot-detection rather
 * than 200/404. Checking them does nothing useful; calling them "alive"
 * is the correct outcome.
 */
export const ALWAYS_ALIVE_DOMAINS = [
  "twitter.com",
  "x.com",
  "nitter.net",
  "youtube.com",
  "youtu.be",
  "instagram.com",
  "tiktok.com",
  "facebook.com",
  "fb.com",
] as const;

/**
 * HTTP statuses that confirm the page is gone, not a transient failure.
 * 410 (Gone) and 451 (Unavailable For Legal Reasons) are explicit.
 * Some servers also return 451 for geofencing; we still consider the
 * link broken in that case because the user can't reach the resource.
 */
const VALID_HIGH_STATUS: ReadonlyArray<number> = [410, 451];

/**
 * HTTP statuses that mean "we couldn't tell" rather than "broken".
 *
 * - 401/403: on a public URL these usually mean bot-detection or
 *   auth-walling, not that the page is gone.
 * - 408: Request Timeout — the client didn't respond in time; transient.
 * - 425: Too Early — 0-RTT TLS replay risk; transient.
 * - 429: Too Many Requests — rate limiting; the resource is fine, we're
 *   being throttled. (Classified as unknown *after* retries are exhausted.)
 *
 * See docs/broken-link-detection-design-review.md §2 R-B, R-E.
 */
const AMBIGUOUS_CLIENT_STATUSES: ReadonlySet<number> = new Set([
  401, 403, 408, 425, 429,
]);

/**
 * 4xx statuses that reflect a client-side/protocol issue rather than the
 * resource being gone. These are routed to `unknown` because fixing the
 * client (Accept header, method, protocol) would likely yield a different
 * verdict — the link itself is not necessarily broken.
 *
 * - 405: Method Not Allowed (handled via GET fallback before classification;
 *   listed here so a residual 405 post-fallback is treated as ambiguous).
 * - 406/415/416: content negotiation — server can't serve the requested
 *   representation; the resource exists, we asked wrong.
 * - 421: Misdirected Request — wrong server connection; transient.
 * - 426: Upgrade Required — must use a different protocol; client issue.
 * - 428: Precondition Required — client must send a precondition.
 * - 431: Request Header Fields Too Large — client header issue.
 */
const AMBIGUOUS_CLIENT_PROTOCOL_STATUSES: ReadonlySet<number> = new Set([
  405, 406, 415, 416, 421, 426, 428, 431,
]);

/**
 * Soft-404 keywords matched inside the body. Kept conservative and
 * requires multiple signals — see detectSoft404.
 */
export const SOFT_404_KEYWORDS = [
  "page not found",
  "doesn't exist",
  "not available",
  "content not found",
  "this page doesn't exist",
  "this content doesn't exist",
] as const;

/**
 * A soft-404 must satisfy a precision tier. See detectSoft404 for the
 * tier definitions. The previous design gated every signal on a single
 * 4 KB threshold; the new design decouples tiers so high-precision
 * signals (canonical /404, error-page CSS class, JSON error payload)
 * fire regardless of body size.
 *
 * See docs/broken-link-detection-design-review.md §2 R-F, R-G.
 */
const SOFT_404_TITLE_404_REGEX = /<title[^>]*>([^<]+)<\/title>/i;

/**
 * Structural soft-404 signals beyond body keywords + title. Each is
 * only trusted when the body is also short (see detectSoft404) — the
 * short-body gate keeps us from flagging real pages that happen to
 * mention "error-page" CSS classes in their chrome.
 */
const SOFT_404_ERROR_CLASS_REGEX =
  /class=["'][^"']*\b(?:error-page|page-404|not-found-page|page-not-found)\b[^"']*["']/i;

const SOFT_404_CANONICAL_REGEX =
  /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i;

/**
 * Canonical URL path shapes that strongly indicate a 404 page. The
 * canonical URL of a real page points at itself; a 404 page often
 * canonicalises to the site's /404 or /not-found route.
 */
const SOFT_404_CANONICAL_PATH_REGEXES = [
  /\/404(?:\.html?|\/|$)/i,
  /\/not-found(?:[/.]|$)/i,
  /\/page-not-found(?:[/.]|$)/i,
];

/**
 * JSON error payloads — APIs that return 200 with an error body.
 * Only checked when the body itself looks like JSON.
 */
const SOFT_404_JSON_REGEXES = [
  /"error"\s*:\s*"(?:not[_ ]?found|404|missing|gone)"/i,
  /"code"\s*:\s*(?:["']?)404(?:["']?)/,
  /"status"\s*:\s*(?:["']?)404(?:["']?)/,
  /"message"\s*:\s*"[^"]*(?:not found|doesn't exist|no longer exists)/i,
];

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Always-alive domain check. Uses hostname matching, not substring,
 * so `https://evil.com/twitter.com` no longer falsely short-circuits.
 * Subdomains of always-alive domains (e.g. `api.twitter.com`) also match.
 */
function isAlwaysAliveDomain(url: string): boolean {
  const hostname = getHostname(url);
  if (!hostname) return false;
  return ALWAYS_ALIVE_DOMAINS.some(
    (d) => hostname === d || hostname.endsWith(`.${d}`),
  );
}

/**
 * Decide a final BrokenStatus from an HTTP status code.
 *
 * The mapping is intentionally explicit and follows HTTP RFC semantics:
 *
 *   - 2xx → `alive` (subject to soft-404 detection in `checkUrl`).
 *   - 410/451 → `confirmed_broken` (explicit "gone" / "legally blocked").
 *   - 404 → `confirmed_broken` (authoritative "not found").
 *   - 400/409/412/422 → `confirmed_broken` (request/resource conflict —
 *     debatable but defensible; these indicate the request can't be
 *     fulfilled as-is for this resource).
 *   - 401/403 → `unknown` (auth/bot-detection; not "gone").
 *   - 408/425/429 → `unknown` (spec-explicit transient: timeout, too-early,
 *     rate-limited).
 *   - 405/406/415/416/421/426/428/431 → `unknown` (client/protocol issue;
 *     the resource may exist — fixing the request would change the verdict).
 *   - 5xx → `unknown` (server-side failure; RFC 9110 §15.6 defines these
 *     as "the server is currently unable to handle the request," not "the
 *     resource doesn't exist." A 503 with `Retry-After` is explicitly
 *     transient per spec. Previously these were `confirmed_broken`, which
 *     produced false positives on every deploy blip and maintenance window.)
 *   - 1xx / residual 3xx → `unknown`.
 *
 * See docs/broken-link-detection-design-review.md §2 R-D, R-E for the
 * full rationale and RFC citations.
 */
export function classifyByHttpStatus(
  httpStatus: number | null,
): Pick<UrlHealthResult, "isBroken" | "brokenStatus" | "httpStatus"> {
  if (httpStatus == null || httpStatus === 0) {
    return { isBroken: false, brokenStatus: "unknown", httpStatus };
  }
  if (httpStatus === 410 || httpStatus === 451) {
    return { isBroken: true, brokenStatus: "confirmed_broken", httpStatus };
  }
  if (AMBIGUOUS_CLIENT_STATUSES.has(httpStatus)) {
    return { isBroken: false, brokenStatus: "unknown", httpStatus };
  }
  if (AMBIGUOUS_CLIENT_PROTOCOL_STATUSES.has(httpStatus)) {
    return { isBroken: false, brokenStatus: "unknown", httpStatus };
  }
  if (httpStatus >= 500) {
    // 5xx means "the server couldn't handle this request," not "the
    // resource doesn't exist." A 500 during a deploy, a 503 maintenance
    // window, or a 511 captive portal are all transient from the
    // resource's perspective. Classified `unknown` so a transient blip
    // shows amber, not red.
    return { isBroken: false, brokenStatus: "unknown", httpStatus };
  }
  if (httpStatus >= 400) {
    // Remaining 4xx (400, 402, 404, 409, 411-414, 417-420, 422-424,
    // 427, 451-excluded) — 404 is the authoritative "not found"; the
    // rest are client errors that indicate the resource can't be served.
    return { isBroken: true, brokenStatus: "confirmed_broken", httpStatus };
  }
  if (httpStatus >= 200 && httpStatus < 300) {
    return { isBroken: false, brokenStatus: "alive", httpStatus };
  }
  return { isBroken: false, brokenStatus: "unknown", httpStatus };
}

/**
 * Assign a human-readable `reason` string for a non-2xx HTTP status.
 *
 * The `reason` is descriptive metadata — it does NOT decide the verdict
 * (that's `classifyByHttpStatus`). It labels the failure mode so logs and
 * future observability can distinguish "the server was broken" from "we
 * were rate-limited" from "the page is actually gone."
 */
function reasonForClientOrServerError(status: number): string {
  if (status >= 500) return "server_error";
  if (status === 429) return "rate_limited";
  if (status === 408 || status === 425) return "transient";
  if (status === 401) return "auth_required";
  if (status === 403) return "forbidden";
  if (AMBIGUOUS_CLIENT_PROTOCOL_STATUSES.has(status)) return "client_protocol";
  return "client_error";
}

/**
 * Classify a thrown fetch error into the right state. The legacy code
 * returned `{ is_broken: false, reason: "unknown" }` for *every* error —
 * a timeout, a DNS failure, and a connection reset were all collapsed
 * into "looks fine". That was the second main source of false claims:
 * a transient network blip could look healthy forever.
 *
 * The rule: connection-level failures are NOT broken. A timeout might
 * just be a slow page. DNS failure / connection reset / too many
 * redirects are unknowns — visible in the UI but not asserted as broken.
 */
export function classifyFetchError(error: unknown): UrlHealthResult {
  // AbortError covers our own timeout (we use AbortController with
  // TIMEOUT_MS).
  const isTimeout =
    error instanceof Error &&
    (error.name === "AbortError" || /aborted/i.test(error.message));
  if (isTimeout) {
    return {
      brokenStatus: "unknown",
      isBroken: false,
      httpStatus: 0,
      reason: "timeout",
    };
  }
  if (error instanceof Error && /Too many redirects/i.test(error.message)) {
    return {
      brokenStatus: "unknown",
      isBroken: false,
      httpStatus: 0,
      reason: "too_many_redirects",
    };
  }
  if (error instanceof Error && /Redirect loop/i.test(error.message)) {
    return {
      brokenStatus: "unknown",
      isBroken: false,
      httpStatus: 0,
      reason: "redirect_loop",
    };
  }
  if (error instanceof TypeError || error instanceof DOMException) {
    // Network-level failures surface as TypeError in most runtimes.
    return {
      brokenStatus: "unknown",
      isBroken: false,
      httpStatus: 0,
      reason: "network_error",
    };
  }
  return {
    brokenStatus: "unknown",
    isBroken: false,
    httpStatus: 0,
    reason: "unknown",
  };
}

export interface Soft404Detection {
  isSoft404: boolean;
  reason?:
    | "soft404_combined"
    | "soft404_error_class"
    | "soft404_canonical"
    | "soft404_json_error";
}

function hasCanonical404Path(body: string): boolean {
  const match = body.match(SOFT_404_CANONICAL_REGEX);
  if (!match?.[1]) return false;
  const canonicalUrl = match[1];
  return SOFT_404_CANONICAL_PATH_REGEXES.some((re) => re.test(canonicalUrl));
}

function bodyLooksLikeJson(body: string): boolean {
  const trimmed = body.trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

/**
 * Soft-404 detection thresholds, split into precision tiers.
 *
 * The previous design applied a single 4 KB gate to every signal. That
 * disabled the highest-precision signals (canonical /404, error-page
 * CSS class) on large CMS-generated 404 pages — the exact sites whose
 * 404s are richest.
 *
 * Tier 1 signals are near-definitive: a real page almost never has
 * `<link rel=canonical href="/404">` or a JSON `{"error":"not found"}`
 * body. They fire regardless of body size.
 *
 * Tier 2 signals (title + keyword combination) are reliable but can be
 * tripped by short pages that merely discuss 404s, so they keep a
 * short-body gate — raised from 4 KB to 8 KB to match modern CMS pages.
 *
 * The singleton branches (keyword-only, title-only) have been removed:
 * they were noisy and rarely correct. An empty body (<200 bytes) on a
 * 2xx is flagged as its own weak signal.
 *
 * See docs/broken-link-detection-design-review.md §2 R-F, R-G.
 */
const SOFT_404_TIER2_BODY_THRESHOLD = 8_000;
const SOFT_404_LARGE_BODY_THRESHOLD = 64_000;

/**
 * Detect pages that returned 200 OK but contain "not found" content.
 *
 * Tiers (highest precision first):
 *
 *   1. HIGH precision (fire regardless of body size):
 *      - canonical → /404 | /not-found | /page-not-found → soft404_canonical
 *      - error-page | page-404 | not-found-page | page-not-found CSS class
 *        → soft404_error_class
 *      - JSON body with a not-found/404/gone error payload
 *        → soft404_json_error
 *
 *   2. MEDIUM precision (fire if body < 8 KB):
 *      - title is 404-shaped AND body keyword present → soft404_combined
 *
 * Negative signals (suppress soft-404 even if a tier would fire):
 *   - body > 64 KB (a real long article; no 404 page is this big)
 *
 * The removed singleton branches (keyword-only, title-only) were net
 * false-positive sources: short pages that mention "not found" in
 * non-404 contexts (e.g. "item not in stock", "section not found in
 * config") were flagged as broken. An empty-body heuristic (<200 bytes)
 * was also evaluated and removed — it produced false positives on
 * legitimate short responses (minimal HTML, small JSON API payloads,
 * short "ok" confirmation bodies).
 *
 * See docs/broken-link-detection-design-review.md §2 R-F, R-G.
 */
export function detectSoft404(
  body: string,
  options: { bodyThreshold?: number } = {},
): Soft404Detection {
  if (!body) return { isSoft404: false };

  // Negative signal: a very large body is a real article. Suppress.
  // (None of the tier-1 signals fire on real articles anyway, but this
  // is a cheap guard against a 200 KB page that happens to contain
  // "error-page" in its CSS.)
  if (body.length >= SOFT_404_LARGE_BODY_THRESHOLD) {
    return { isSoft404: false };
  }

  const tier2Threshold = options.bodyThreshold ?? SOFT_404_TIER2_BODY_THRESHOLD;
  const bodyIsShort = body.length < tier2Threshold;

  // --- Tier 1: high-precision structural signals (no body-size gate) ---
  if (bodyLooksLikeJson(body)) {
    if (SOFT_404_JSON_REGEXES.some((re) => re.test(body))) {
      return { isSoft404: true, reason: "soft404_json_error" };
    }
  }
  if (hasCanonical404Path(body)) {
    return { isSoft404: true, reason: "soft404_canonical" };
  }
  if (SOFT_404_ERROR_CLASS_REGEX.test(body)) {
    return { isSoft404: true, reason: "soft404_error_class" };
  }

  // --- Tier 2: combined title + keyword (short-body gated) ---
  if (bodyIsShort) {
    const lower = body.toLowerCase();
    const bodyKeywordMatch = SOFT_404_KEYWORDS.some((k) => lower.includes(k));
    const titleMatch = body.match(SOFT_404_TITLE_404_REGEX);
    const title = (titleMatch?.[1] ?? "").trim().toLowerCase();
    const titleIndicates404 =
      title.includes("404") ||
      title === "not found" ||
      title === "page not found";

    if (bodyKeywordMatch && titleIndicates404) {
      return { isSoft404: true, reason: "soft404_combined" };
    }
  }

  return { isSoft404: false };
}

interface CheckOptions {
  retries?: number;
  timeoutMs?: number;
}

/**
 * Fall back to GET when HEAD is refused (405) or blocked (403). Returns a
 * fully-classified result so callers don't repeat the classification
 * logic.
 */
async function tryGetFallback(
  url: string,
  opts: CheckOptions,
): Promise<UrlHealthResult> {
  try {
    const { response } = await httpFetch(url, {
      method: "GET",
      timeout: opts.timeoutMs ?? TIMEOUT_MS,
      retries: opts.retries ?? MAX_RETRIES,
      headers: { Accept: "text/html" },
    });
    return {
      ...classifyByHttpStatus(response.status),
      reason:
        response.status >= 400
          ? `fallback_get_${reasonForClientOrServerError(response.status)}`
          : "ok_get",
    };
  } catch (error) {
    return classifyFetchError(error);
  }
}

/**
 * Run the soft-404 detection against the first 8 KB of the body. If a
 * soft-404 is detected the URL is "likely_broken" rather than
 * "confirmed_broken" because a soft-404 is still a heuristic.
 *
 * @returns `null` if no soft-404 signal (i.e. we trust the 2xx), or a
 * UrlHealthResult with `likely_broken` status otherwise.
 */
async function checkForSoft404(
  url: string,
  finalStatus: number,
): Promise<UrlHealthResult | null> {
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
    if (!response.ok) return null;

    let text: string;
    try {
      text = await readResponseBody(response, 8_192);
    } catch {
      return null;
    }

    const detection = detectSoft404(text);
    if (!detection.isSoft404) return null;

    return {
      isBroken: true,
      brokenStatus: "likely_broken",
      httpStatus: finalStatus,
      reason: detection.reason ?? "soft404",
    };
  } catch (error) {
    logger.warn("Soft-404 probe failed", { url, error });
    return null;
  }
}

/**
 * The single URL checker. Returns a result classified into
 * BrokenStatus — never into a transient boolean that callers have to
 * re-interpret.
 */
export async function checkUrl(
  url: string,
  opts: CheckOptions = {},
): Promise<UrlHealthResult> {
  if (isAlwaysAliveDomain(url)) {
    return {
      brokenStatus: "alive",
      isBroken: false,
      httpStatus: 200,
      reason: "always_alive",
    };
  }

  let response: Response;
  try {
    const result = await httpFetch(url, {
      method: "HEAD",
      timeout: opts.timeoutMs ?? TIMEOUT_MS,
      retries: opts.retries ?? MAX_RETRIES,
      followRedirect: true,
    });
    response = result.response;
  } catch (error) {
    return classifyFetchError(error);
  }

  const status = response.status;

  // HEAD refused or blocked. Some servers (GitHub, Cloudflare-fronted)
  // outright 403/405 automated HEAD requests. GET with a real Accept
  // header usually works.
  if (status === 405 || status === 403) {
    const fallback = await tryGetFallback(url, opts);
    if (fallback.brokenStatus === "alive") {
      return await maybeDowngradeToSoft404(url, fallback, 200);
    }
    return fallback;
  }

  // Server told us something definitive or ambiguous. No soft-404 probe
  // needed for non-2xx — the status itself is the verdict.
  if (status >= 400) {
    if (VALID_HIGH_STATUS.includes(status)) {
      return {
        isBroken: true,
        brokenStatus: "confirmed_broken",
        httpStatus: status,
        reason: "gone",
      };
    }
    // Pick a reason that describes *why* the verdict is what it is.
    // classifyByHttpStatus decides the state; this just labels it.
    const reason = reasonForClientOrServerError(status);
    return {
      ...classifyByHttpStatus(status),
      reason,
    };
  }

  // 2xx. We still need to check whether it's a soft-404 page.
  if (status >= 200 && status < 300) {
    const upgraded = await checkForSoft404(url, status);
    if (upgraded) return upgraded;
    return {
      brokenStatus: "alive",
      isBroken: false,
      httpStatus: status,
      reason: "ok",
    };
  }

  // 1xx, 3xx (without redirects following succeeding), etc.
  return {
    brokenStatus: "unknown",
    isBroken: false,
    httpStatus: status,
    reason: "unexpected_status",
  };
}

/**
 * Soft-404 detector returns "likely_broken", but for a 200 the most
 * trustworthy signal is still the body; this helper shields the rest of
 * `checkUrl` from having to repeat the soft-404 logic.
 */
async function maybeDowngradeToSoft404(
  url: string,
  alive: UrlHealthResult,
  finalStatus: number,
): Promise<UrlHealthResult> {
  const upgraded = await checkForSoft404(url, finalStatus);
  return upgraded ?? alive;
}
