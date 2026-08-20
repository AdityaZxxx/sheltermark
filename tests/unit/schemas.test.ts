import { describe, expect, it } from "bun:test";

import { slugSchema } from "~/lib/schemas/common";

describe("slugSchema", () => {
  it("accepts valid slug", () => {
    expect(slugSchema.safeParse("my-bookmark-collection").success).toBe(true);
  });

  it("rejects slug with leading hyphen", () => {
    expect(slugSchema.safeParse("-leading").success).toBe(false);
  });

  it("rejects slug with uppercase", () => {
    expect(slugSchema.safeParse("UpperCase").success).toBe(false);
  });
});
