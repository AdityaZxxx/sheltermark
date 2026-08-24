import { describe, expect, it, mock } from "bun:test";
import { z } from "zod";

const loggerError = mock();

mock.module("~/lib/utils/logger", () => ({
  logger: { error: loggerError, warn: mock(), info: mock() },
}));

const { dbError, invalidData, supabaseError, GENERIC_ERROR } =
  await import("~/lib/action-result");
const { friendlyAuthError } = await import("~/lib/supabase/auth-error");

describe("result failure sanitizers", () => {
  it("dbError never surfaces the raw cause message", () => {
    const result = dbError(
      "Bookmark",
      new Error("duplicate key value violates unique constraint"),
    );
    expect(result).toEqual({ success: false, error: GENERIC_ERROR });
  });

  it("supabaseError never surfaces the raw auth/storage message", () => {
    const result = supabaseError("Profile avatar upload", {
      message: "Bucket not found: avatars",
      status: 400,
    });
    expect(result).toEqual({ success: false, error: GENERIC_ERROR });
  });

  it("invalidData never surfaces the raw Zod payload", () => {
    const parsed = z.object({ id: z.string() }).safeParse({});
    const error = invalidData("Tag", parsed.error!);
    expect(error).toBe(GENERIC_ERROR);
  });

  it("sanitizers log the cause server-side for debugging", () => {
    const cause = new Error("connect ECONNREFUSED");
    dbError("Feed", cause);
    expect(loggerError).toHaveBeenCalled();
    // SAFETY: the mock's call args are known by construction in this test.
    const lastCall = loggerError.mock.calls.at(-1)?.[1] as { error: unknown };
    expect(lastCall.error).toBe(cause);
  });

  it("non-Error causes are handled too", () => {
    expect(dbError("Bookmark", "just a string").error).toBe(GENERIC_ERROR);
    expect(supabaseError("Profile", undefined).error).toBe(GENERIC_ERROR);
  });
});

describe("friendlyAuthError whitelist", () => {
  it("passes through known user-appropriate messages", () => {
    expect(friendlyAuthError({ message: "User already registered" })).toBe(
      "User already registered",
    );
    expect(friendlyAuthError({ message: "Invalid login credentials" })).toBe(
      "Invalid login credentials",
    );
    expect(
      friendlyAuthError({
        message: "Password should be at least 6 characters",
      }),
    ).toContain("Password should be at least");
  });

  it("replaces infrastructure messages with the generic text", () => {
    expect(friendlyAuthError({ message: "Database timeout after 30s" })).toBe(
      GENERIC_ERROR,
    );
    expect(friendlyAuthError({ message: "" })).toBe(GENERIC_ERROR);
  });
});
