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

export interface UrlHealthResult {
  brokenStatus: BrokenStatus;
  isBroken: boolean;
  httpStatus: number | null;
  reason: string;
}
