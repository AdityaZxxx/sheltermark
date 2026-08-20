import { describe, expect, it } from "bun:test";

import { getBrokenLinkMessage, resolveBrokenState } from "~/lib/utils";

describe("getBrokenLinkMessage", () => {
  it("returns generic message for null status", () => {
    expect(getBrokenLinkMessage(null)).toBe("Link unreachable");
  });

  it("returns message for status 0", () => {
    expect(getBrokenLinkMessage(0)).toBe("Connection timeout");
  });

  it("returns message for 401", () => {
    expect(getBrokenLinkMessage(401)).toBe("Authentication required");
  });

  it("returns message for 403", () => {
    expect(getBrokenLinkMessage(403)).toBe("Access denied by server");
  });

  it("returns message for 404", () => {
    expect(getBrokenLinkMessage(404)).toBe("Page not found");
  });

  it("returns message for 410", () => {
    expect(getBrokenLinkMessage(410)).toBe("Page permanently deleted");
  });

  it("returns server error for 5xx", () => {
    expect(getBrokenLinkMessage(502)).toBe("Server error");
  });

  it("returns rate-limited message for 429", () => {
    expect(getBrokenLinkMessage(429)).toBe("Rate limited (try again later)");
  });

  it("returns timeout message for 408", () => {
    expect(getBrokenLinkMessage(408)).toBe("Request timed out");
  });

  it("returns generic error for other 4xx", () => {
    expect(getBrokenLinkMessage(400)).toBe("Error (400)");
  });
});

describe("resolveBrokenState", () => {
  it("surfaces confirmed_broken with http-status text", () => {
    const state = resolveBrokenState({
      status: "confirmed_broken",
      httpStatus: 404,
    });
    expect(state.showWarning).toBe(true);
    expect(state.severity).toBe("warning");
    expect(state.message).toBe("Page not found");
  });

  it("surfaces likely_broken with subtle severity", () => {
    const state = resolveBrokenState({
      status: "likely_broken",
      httpStatus: 200,
    });
    expect(state.showWarning).toBe(true);
    expect(state.severity).toBe("subtle");
    expect(state.message).toMatch(/Likely broken/i);
  });

  it("surfaces unknown as subtle, not red", () => {
    const state = resolveBrokenState({
      status: "unknown",
      httpStatus: 0,
    });
    expect(state.showWarning).toBe(true);
    expect(state.severity).toBe("subtle");
  });

  it("hides the warning for alive", () => {
    const state = resolveBrokenState({
      status: "alive",
      httpStatus: 200,
    });
    expect(state.showWarning).toBe(false);
  });

  it("hides the warning for never-checked bookmarks (no status, no http_status)", () => {
    const state = resolveBrokenState({
      status: null,
      httpStatus: null,
    });
    expect(state.showWarning).toBe(false);
    expect(state.severity).toBe("none");
  });

  it("infers from http_status when broken_status is missing (legacy bookmarks)", () => {
    const inferred = resolveBrokenState({ httpStatus: 404 });
    expect(inferred.showWarning).toBe(true);
    expect(inferred.severity).toBe("warning");
  });

  it("treats legacy 401 as unknown, not confirmed_broken", () => {
    // A public URL returning 401 is usually an auth wall or bot-detection,
    // not a definitively gone page — mirroring the checker's classification.
    const state = resolveBrokenState({ httpStatus: 401 });
    expect(state.showWarning).toBe(true);
    expect(state.severity).toBe("subtle");
  });

  it("treats legacy 403 as unknown, not confirmed_broken", () => {
    const state = resolveBrokenState({ httpStatus: 403 });
    expect(state.showWarning).toBe(true);
    expect(state.severity).toBe("subtle");
  });
});
