/**
 * Broken-link UI helpers.
 *
 * The Link Health context maintains a `broken_status` enum on each
 * bookmark. This module is the only place that knows how to render that
 * status into:
 *   - a human-readable message
 *   - a flag for "should the UI show a warning"
 *
 * Keeping all of these decisions in one pure module means callers can
 * stay both UI- and data-agnostic.
 */

/**
 * The set of states the URL checker can leave a bookmark in.
 */
export type BrokenStatus =
  | "alive"
  | "confirmed_broken"
  | "likely_broken"
  | "unknown";

export const BROKEN_STATUSES = [
  "alive",
  "confirmed_broken",
  "likely_broken",
  "unknown",
] as const satisfies readonly BrokenStatus[];

export interface RenderableBrokenState {
  /** Should the warning icon be drawn? */
  showWarning: boolean;
  /** Tooltip / a11y label explaining the current state. */
  message: string;
  /** Severity — distinct colors for confirmed vs uncertain. */
  severity: "warning" | "subtle" | "none";
}

interface BrokenStateInput {
  status?: BrokenStatus | string | null;
  httpStatus?: number | null;
}

/**
 * Map a numeric HTTP status to a one-line description. Preserved verbatim
 * for callers that only have a status code (no confidence info).
 */
export function getBrokenLinkMessage(
  status: number | null | undefined,
): string {
  // Null or undefined means the link couldn't be reached at all
  if (status == null) return "Link unreachable";
  // Status 0 indicates a network timeout
  if (status === 0) return "Connection timeout";
  if (status === 401) return "Authentication required";
  if (status === 403) return "Access denied by server";
  if (status === 404) return "Page not found";
  if (status === 410) return "Page permanently deleted";
  if (status === 408) return "Request timed out";
  if (status === 429) return "Rate limited (try again later)";
  if (status >= 500) return "Server error";
  if (status >= 400) return `Error (${status})`;
  return "Link issue";
}

const KNOWN_BROKEN_STATUSES: ReadonlySet<string> = new Set([
  "confirmed_broken",
  "likely_broken",
  ...BROKEN_STATUSES,
]);

function normalizeStatus(input: BrokenStateInput): BrokenStatus {
  const candidate = input.status ?? null;
  if (candidate && KNOWN_BROKEN_STATUSES.has(candidate)) {
    return candidate as BrokenStatus;
  }
  // No status recorded yet. Infer from http_status the way the legacy
  // UI code did so callers upgrading between the two schemas still see
  // something sensible. Mirrors classifyByHttpStatus in the checker:
  // 5xx and transient 4xx (408/429/etc.) are `unknown`, not broken,
  // because they reflect server-side/transient failure — the resource
  // may still exist.
  const http = input.httpStatus;
  if (http == null || http === 0) return "unknown";
  if (http === 401 || http === 403) return "unknown";
  if (http === 408 || http === 425 || http === 429) return "unknown";
  if (http >= 500) return "unknown";
  if (http >= 400) return "confirmed_broken";
  if (http >= 200 && http < 300) return "alive";
  return "unknown";
}

/**
 * Resolve a bookmark's broken-link fields into the shape the UI needs.
 *
 * Centralises the rules so:
 *   - confidence affects severity, not just text
 *   - callers don't accidentally regress one rule while changing another
 */
export function resolveBrokenState(
  input: BrokenStateInput,
): RenderableBrokenState {
  const status = normalizeStatus(input);

  switch (status) {
    case "alive":
      return { showWarning: false, message: "Working", severity: "none" };
    case "confirmed_broken":
      return {
        showWarning: true,
        message: getBrokenLinkMessage(input.httpStatus ?? null),
        severity: "warning",
      };
    case "likely_broken":
      return {
        showWarning: true,
        message:
          input.httpStatus != null
            ? `Likely broken — ${getBrokenLinkMessage(input.httpStatus)}`
            : "Likely broken (heuristic match)",
        severity: "subtle",
      };
    case "unknown":
      return {
        showWarning: true,
        message: "Couldn't be reached — status unknown",
        severity: "subtle",
      };
    default: {
      // Defensive: never reached unless BROKEN_STATUSES grows without
      // this switch being updated.
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
