import { describe, expect, it } from "bun:test";

import type { Tag, TagWithCount } from "~/lib/schemas/tag.schema";
import type { TagEntry } from "~/lib/utils/tag-entries";

import {
  entriesEqual,
  filterTagSuggestions,
  MAX_AI_SUGGESTIONS,
  mergeSuggestedTags,
  tagKeyAction,
  tagsToEntries,
} from "~/lib/utils/tag-entries";

const baseTag: Pick<Tag, "user_id" | "created_at"> = {
  user_id: "u1",
  created_at: "2026-01-01T00:00:00Z",
};

const makeTag = (id: string, name: string): Tag => ({
  id,
  ...baseTag,
  name,
});

const makeTagWithCount = (
  id: string,
  name: string,
  count = 0,
): TagWithCount => ({
  id,
  ...baseTag,
  name,
  count,
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

describe("filterTagSuggestions", () => {
  const [design, react] = [
    makeTagWithCount("a", "Design", 3),
    makeTagWithCount("b", "React", 1),
  ];

  it("returns all tags for empty entries and empty query", () => {
    expect(filterTagSuggestions([design, react], [], "")).toEqual([
      design,
      react,
    ]);
  });

  it("excludes tags already chosen by id", () => {
    const entries = [{ id: "a", name: "Design" }];
    expect(filterTagSuggestions([design, react], entries, "")).toEqual([react]);
  });

  it("excludes by case-insensitive name when the entry has no id yet", () => {
    const entries = [{ name: "design" }];
    expect(filterTagSuggestions([design, react], entries, "")).toEqual([react]);
  });

  it("filters by case-insensitive substring query", () => {
    expect(filterTagSuggestions([design, react], [], "EACT")).toEqual([react]);
  });

  it("excludes used tags before matching the query", () => {
    const entries = [{ id: "a", name: "Design" }];
    expect(filterTagSuggestions([design, react], entries, "desi")).toEqual([]);
  });
});

describe("mergeSuggestedTags", () => {
  const userTags = [makeTag("a", "Design"), makeTag("b", "React")];

  it("applies a single candidate as a name-only entry", () => {
    expect(mergeSuggestedTags([], ["frontend"], [])).toEqual([
      { name: "frontend" },
    ]);
  });

  it("apply-all preserves existing order and appends only new candidates", () => {
    const current: TagEntry[] = [{ name: "notes" }];
    const result = mergeSuggestedTags(
      current,
      ["css", "react", "design"],
      userTags,
    );
    expect(result).toEqual([
      { name: "notes" },
      { name: "css" },
      { id: "b", name: "React" },
      { id: "a", name: "Design" },
    ]);
    // Original array untouched.
    expect(current).toEqual([{ name: "notes" }]);
  });

  it("skips candidates already present, case-insensitively", () => {
    const current: TagEntry[] = [{ name: "Design" }];
    expect(mergeSuggestedTags(current, ["DESIGN", "css"], userTags)).toEqual([
      { name: "Design" },
      { name: "css" },
    ]);
  });

  it("matches an existing tag by name, reusing its id and canonical casing", () => {
    expect(mergeSuggestedTags([], ["REACT"], userTags)).toEqual([
      { id: "b", name: "React" },
    ]);
  });

  it("preserves manually typed tags", () => {
    const current: TagEntry[] = [
      { name: "my draft" },
      { id: "z", name: "kept" },
    ];
    const result = mergeSuggestedTags(current, ["css"], []);
    expect(result.slice(0, 2)).toEqual(current);
    expect(result).toHaveLength(3);
  });

  it("ignores empty and whitespace-only candidates", () => {
    expect(mergeSuggestedTags([], ["", "   ", "css"], [])).toEqual([
      { name: "css" },
    ]);
  });

  it("ignores duplicate candidates within the batch", () => {
    expect(mergeSuggestedTags([], ["css", "CSS", " css "], [])).toEqual([
      { name: "css" },
    ]);
  });

  it(`caps candidates at ${MAX_AI_SUGGESTIONS}`, () => {
    const candidates = ["a", "b", "c", "d", "e", "f", "g"];
    expect(mergeSuggestedTags([], candidates, [])).toHaveLength(
      MAX_AI_SUGGESTIONS,
    );
  });
});

describe("tagKeyAction", () => {
  it("moves down until the last option, then stays put", () => {
    expect(tagKeyAction("ArrowDown", -1, 2)).toBe("down");
    expect(tagKeyAction("ArrowDown", 0, 2)).toBe("down");
    expect(tagKeyAction("ArrowDown", 1, 2)).toBe("none");
    expect(tagKeyAction("ArrowDown", -1, 0)).toBe("none");
  });

  it("does not move up past the first option", () => {
    expect(tagKeyAction("ArrowUp", -1, 2)).toBe("none");
    expect(tagKeyAction("ArrowUp", 1, 2)).toBe("up");
  });

  it("activates a highlighted option on Enter, otherwise commits input", () => {
    expect(tagKeyAction("Enter", 1, 3)).toBe("activate");
    expect(tagKeyAction("Enter", -1, 3)).toBe("commit");
    expect(tagKeyAction("Enter", -1, 0)).toBe("commit");
  });

  it("ignores keys outside the navigation set (Escape is handled by the component)", () => {
    expect(tagKeyAction("Escape", 0, 2)).toBe("none");
    expect(tagKeyAction("Tab", 0, 2)).toBe("none");
  });
});
