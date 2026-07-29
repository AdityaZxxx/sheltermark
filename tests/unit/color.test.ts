import { describe, expect, it } from "bun:test";

import { getPastelColor } from "~/lib/utils";

describe("getPastelColor", () => {
  it("returns muted for default id", () => {
    expect(getPastelColor("default")).toBe("bg-muted");
  });

  it("returns muted for empty id", () => {
    expect(getPastelColor("")).toBe("bg-muted");
  });

  it("returns a color for a given id", () => {
    const color = getPastelColor("my-workspace");
    expect(color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("returns consistent color for same id", () => {
    expect(getPastelColor("test-id")).toBe(getPastelColor("test-id"));
  });
});
