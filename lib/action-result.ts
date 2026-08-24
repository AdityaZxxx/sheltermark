import type { ZodError } from "zod";

import { logger } from "~/lib/utils/logger";

export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

export const GENERIC_ERROR = "Something went wrong. Please try again.";

/**
 * The failure shape alone, so it is assignable inside any ActionResult
 * union regardless of the success branch's payload.
 */
export type ResultFailure = { success: false; error: string };

// Raw exception/driver messages stay in server logs; clients only ever
// receive GENERIC_ERROR or deliberate domain messages. A structured error
// taxonomy (machine-readable codes) is intentionally deferred: the only
// consumer today is toast display, HTTP routes already branch on status
// codes, and branching behavior (e.g. duplicate flags) is modeled
// explicitly on the result type. Revisit if a consumer needs to branch on
// failure kind.
export function dbError(scope: string, cause: unknown): ResultFailure {
  logger.error(`${scope} database error`, { error: cause });
  return { success: false, error: GENERIC_ERROR };
}

export function supabaseError(scope: string, cause: unknown): ResultFailure {
  logger.error(`${scope} Supabase error`, { error: cause });
  return { success: false, error: GENERIC_ERROR };
}

export function invalidData(scope: string, cause: ZodError): string {
  logger.error(`${scope} validation failed`, { error: cause });
  return GENERIC_ERROR;
}
