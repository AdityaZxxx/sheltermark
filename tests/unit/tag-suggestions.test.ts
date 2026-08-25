import { describe, expect, it } from "bun:test";

import { parseTagSuggestions } from "~/lib/ai/generate-tag-suggestions";

describe("parseTagSuggestions", () => {
  it("parses a plain JSON object", () => {
    expect(parseTagSuggestions('{"tags": ["react", "tutorial"]}')).toEqual([
      "react",
      "tutorial",
    ]);
  });

  it("extracts JSON embedded in surrounding prose", () => {
    expect(
      parseTagSuggestions(
        'Here you go:\n{"tags": ["design"]}\nHope that helps!',
      ),
    ).toEqual(["design"]);
  });

  it("returns empty for malformed JSON", () => {
    expect(parseTagSuggestions('{"tags": ["react"')).toEqual([]);
  });

  it("returns empty for non-JSON output", () => {
    expect(parseTagSuggestions("react, tutorial, frontend")).toEqual([]);
  });

  it("returns empty when tags is not an array", () => {
    expect(parseTagSuggestions('{"tags": "react"}')).toEqual([]);
  });

  it("drops non-string items", () => {
    expect(parseTagSuggestions('{"tags": ["react", 42, null, "css"]}')).toEqual(
      ["react", "css"],
    );
  });

  it("normalizes whitespace and drops empties", () => {
    expect(
      parseTagSuggestions(
        '{"tags": ["  react   tutorial ", "", "   ", "css"]}',
      ),
    ).toEqual(["react tutorial", "css"]);
  });

  it("deduplicates case-insensitively keeping the first occurrence", () => {
    expect(parseTagSuggestions('{"tags": ["React", "REACT", "css"]}')).toEqual([
      "React",
      "css",
    ]);
  });

  it("caps candidates at five", () => {
    const raw = '{"tags": ["a", "b", "c", "d", "e", "f", "g"]}';
    expect(parseTagSuggestions(raw)).toEqual(["a", "b", "c", "d", "e"]);
  });
});
