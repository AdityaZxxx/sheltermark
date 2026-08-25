import { describe, expect, it } from "bun:test";

import type { ActionResult } from "~/lib/action-result";

import { GENERIC_ERROR } from "~/lib/action-result";
import { resolveResultToast } from "~/lib/mutations/base";

const OPTS = { errorMessage: "Operation failed", successMessage: null };

describe("resolveResultToast", () => {
  it("routes failures through the single error path", () => {
    const spec = resolveResultToast(
      { success: false, error: "Bookmark not found" },
      OPTS,
    );
    expect(spec).toEqual({
      type: "error",
      message: "Bookmark not found",
    });
  });

  it("falls back to errorMessage when a failure carries no message", () => {
    // SAFETY: defensive path for malformed results arriving at runtime.
    const broken = { success: false } as ActionResult<null>;
    const spec = resolveResultToast(broken, {
      errorMessage: "Operation failed",
      successMessage: null,
    });
    expect(spec).toEqual({ type: "error", message: "Operation failed" });
  });

  it("surfaces sanitized server messages verbatim (never raw infra text)", () => {
    const spec = resolveResultToast(
      { success: false, error: GENERIC_ERROR },
      OPTS,
    );
    expect(spec).toEqual({ type: "error", message: GENERIC_ERROR });
  });

  it("emits the configured success toast with data on success", () => {
    const spec = resolveResultToast(
      { success: true, data: { count: 3 } },
      {
        errorMessage: "Operation failed",
        successMessage: "Bookmarks restored",
      },
    );
    expect(spec).toEqual({
      type: "success",
      message: "Bookmarks restored",
      data: { count: 3 },
    });
  });

  it("returns null message for silent successes (successMessage: null)", () => {
    const spec = resolveResultToast({ success: true, data: null }, OPTS);
    expect(spec).toEqual({ type: "success", message: null, data: null });
  });
});
