import type { BrokenStatus, UrlHealthResult } from "./types";
import { BROKEN_STATUSES } from "./types";

export const VALID_HIGH_STATUS: ReadonlyArray<number> = [410, 451];

const AMBIGUOUS_CLIENT_STATUSES: ReadonlySet<number> = new Set([
  401, 403, 408, 425, 429,
]);

export const AMBIGUOUS_CLIENT_PROTOCOL_STATUSES: ReadonlySet<number> = new Set([
  405, 406, 415, 416, 421, 426, 428, 431,
]);

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
    return { isBroken: false, brokenStatus: "unknown", httpStatus };
  }
  if (httpStatus >= 400) {
    return { isBroken: true, brokenStatus: "confirmed_broken", httpStatus };
  }
  if (httpStatus >= 200 && httpStatus < 300) {
    return { isBroken: false, brokenStatus: "alive", httpStatus };
  }
  return { isBroken: false, brokenStatus: "unknown", httpStatus };
}

export function classifyFetchError(error: unknown): UrlHealthResult {
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

export function resolveBrokenStatus(
  dbStatus: BrokenStatus | string | null | undefined,
  httpStatus: number | null,
): BrokenStatus {
  if (dbStatus && (BROKEN_STATUSES as readonly string[]).includes(dbStatus)) {
    return dbStatus as BrokenStatus;
  }
  return classifyByHttpStatus(httpStatus).brokenStatus;
}
