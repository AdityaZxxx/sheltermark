import type { BrokenStatus } from "~/lib/link-health/types";

import { resolveBrokenStatus } from "~/lib/link-health/classifier";

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

export function resolveBrokenState(
  input: BrokenStateInput,
): RenderableBrokenState {
  if (input.status == null && input.httpStatus == null) {
    return {
      showWarning: false,
      message: "Not checked yet",
      severity: "none",
    };
  }

  const status = resolveBrokenStatus(
    input.status ?? null,
    input.httpStatus ?? null,
  );

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
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}
