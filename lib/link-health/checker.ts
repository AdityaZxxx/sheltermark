import {
  AMBIGUOUS_CLIENT_PROTOCOL_STATUSES,
  classifyByHttpStatus,
  classifyFetchError,
  VALID_HIGH_STATUS,
} from "~/lib/link-health/classifier";
import { isAlwaysAliveDomain } from "~/lib/link-health/domains";
import type { UrlHealthResult } from "~/lib/link-health/types";
import { logger } from "~/lib/logger";
import { httpFetch, readResponseBody } from "~/lib/utils/http-fetch";

const TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;

export const SOFT_404_KEYWORDS = [
  "page not found",
  "doesn't exist",
  "not available",
  "content not found",
  "this page doesn't exist",
  "this content doesn't exist",
] as const;

const SOFT_404_TITLE_404_REGEX = /<title[^>]*>([^<]+)<\/title>/i;

const SOFT_404_ERROR_CLASS_REGEX =
  /class=["'][^"']*\b(?:error-page|page-404|not-found-page|page-not-found)\b[^"']*["']/i;

const SOFT_404_CANONICAL_REGEX =
  /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i;

const SOFT_404_CANONICAL_PATH_REGEXES = [
  /\/404(?:\.html?|\/|$)/i,
  /\/not-found(?:[/.]|$)/i,
  /\/page-not-found(?:[/.]|$)/i,
];

const SOFT_404_JSON_REGEXES = [
  /"error"\s*:\s*"(?:not[_ ]?found|404|missing|gone)"/i,
  /"code"\s*:\s*(?:["']?)404(?:["']?)/,
  /"status"\s*:\s*(?:["']?)404(?:["']?)/,
  /"message"\s*:\s*"[^"]*(?:not found|doesn't exist|no longer exists)/i,
];

function reasonForClientOrServerError(status: number): string {
  if (status >= 500) return "server_error";
  if (status === 429) return "rate_limited";
  if (status === 408 || status === 425) return "transient";
  if (status === 401) return "auth_required";
  if (status === 403) return "forbidden";
  if (AMBIGUOUS_CLIENT_PROTOCOL_STATUSES.has(status)) return "client_protocol";
  return "client_error";
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

const SOFT_404_TIER2_BODY_THRESHOLD = 8_000;
const SOFT_404_LARGE_BODY_THRESHOLD = 64_000;

export function detectSoft404(
  body: string,
  options: { bodyThreshold?: number } = {},
): Soft404Detection {
  if (!body) return { isSoft404: false };

  if (body.length >= SOFT_404_LARGE_BODY_THRESHOLD) {
    return { isSoft404: false };
  }

  const tier2Threshold = options.bodyThreshold ?? SOFT_404_TIER2_BODY_THRESHOLD;
  const bodyIsShort = body.length < tier2Threshold;

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

  if (status === 405 || status === 403) {
    const fallback = await tryGetFallback(url, opts);
    if (fallback.brokenStatus === "alive") {
      return await maybeDowngradeToSoft404(url, fallback, 200);
    }
    return fallback;
  }

  if (status >= 400) {
    if (VALID_HIGH_STATUS.includes(status)) {
      return {
        isBroken: true,
        brokenStatus: "confirmed_broken",
        httpStatus: status,
        reason: "gone",
      };
    }
    const reason = reasonForClientOrServerError(status);
    return {
      ...classifyByHttpStatus(status),
      reason,
    };
  }

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

  return {
    brokenStatus: "unknown",
    isBroken: false,
    httpStatus: status,
    reason: "unexpected_status",
  };
}

async function maybeDowngradeToSoft404(
  url: string,
  alive: UrlHealthResult,
  finalStatus: number,
): Promise<UrlHealthResult> {
  const upgraded = await checkForSoft404(url, finalStatus);
  return upgraded ?? alive;
}
