import { describe, expect, it } from "bun:test";

import type { Tag } from "~/lib/schemas/tag.schema";

import { entriesEqual, tagsToEntries } from "~/lib/utils/tag-entries";

const baseTag: Pick<Tag, "user_id" | "created_at"> = {
  user_id: "u1",
  created_at: "2026-01-01T00:00:00Z",
};

const makeTag = (id: string, name: string): Tag => ({
  id,
  ...baseTag,
  name,
});

describe("tagsToEntries", () => {
  it("maps tags to entries preserving id and name", () => {
    const tags = [makeTag("a", "Design"), makeTag("b", "React")];
    expect(tagsToEntries(tags)).toEqual([
      { id: "a", name: "Design" },
      { id: "b", name: "React" },
    ]);
  });

  it("returns empty list for empty input", () => {
    expect(tagsToEntries([])).toEqual([]);
  });
});

describe("entriesEqual", () => {
  it("returns true for identical lists", () => {
    const a = [{ id: "1", name: "design" }];
    const b = [{ id: "1", name: "design" }];
    expect(entriesEqual(a, b)).toBe(true);
  });

  it("returns false for different lengths", () => {
    const a = [{ id: "1", name: "design" }];
    const b = [
      { id: "1", name: "design" },
      { id: "2", name: "react" },
    ];
    expect(entriesEqual(a, b)).toBe(false);
  });

  it("matches by id when both have ids, regardless of name casing", () => {
    const a = [{ id: "1", name: "design" }];
    const b = [{ id: "1", name: "DESIGN" }];
    expect(entriesEqual(a, b)).toBe(true);
  });

  it("matches by name (case-insensitive) when ids are missing", () => {
    const a = [{ name: "design" }];
    const b = [{ name: "DESIGN" }];
    expect(entriesEqual(a, b)).toBe(true);
  });

  it("returns false when one entry has id and the other does not, even with same name", () => {
    const a = [{ id: "1", name: "design" }];
    const b = [{ name: "design" }];
    expect(entriesEqual(a, b)).toBe(false);
  });

  it("is order-independent", () => {
    const a = [
      { id: "1", name: "design" },
      { id: "2", name: "react" },
    ];
    const b = [
      { id: "2", name: "react" },
      { id: "1", name: "design" },
    ];
    expect(entriesEqual(a, b)).toBe(true);
  });

  it("returns false for different ids with same length and name overlap", () => {
    const a = [{ id: "1", name: "design" }];
    const b = [{ id: "2", name: "design" }];
    expect(entriesEqual(a, b)).toBe(false);
  });
});
