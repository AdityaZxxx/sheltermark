import { describe, expect, it } from "bun:test";

import {
  MAX_SEARCH_TERMS,
  parseSearchTerms,
} from "~/lib/ai/interpret-search-query";
import { interpretSearchQueryRepo } from "~/lib/data/repositories/bookmark.repository";

// Unique per suite: checkRateLimit keeps an in-process per-user counter
// shared across this file's cases, so this user is never touched elsewhere.
const USER = "search-interpretation-suite-user";

const countingGenerator = async () => ["react", "performance"];
const failingGenerator = async (): Promise<string[]> => {
  throw new Error("provider exploded");
};
const mustNotCallGenerator = async (): Promise<string[]> => {
  throw new Error("AI generator must not be called");
};

describe("parseSearchTerms", () => {
  it("parses a plain JSON object", () => {
    expect(parseSearchTerms('{"terms": ["react", "performance"]}')).toEqual([
      "react",
      "performance",
    ]);
  });

  it("extracts JSON embedded in surrounding prose", () => {
    expect(parseSearchTerms('Sure!\n{"terms": ["next.js"]}\nDone.')).toEqual([
      "next.js",
    ]);
  });

  it("returns empty for malformed JSON", () => {
    expect(parseSearchTerms('{"terms": ["react"')).toEqual([]);
  });

  it("returns empty for non-JSON output", () => {
    expect(parseSearchTerms("react performance frontend")).toEqual([]);
  });

  it("returns empty when terms is not an array", () => {
    expect(parseSearchTerms('{"terms": "react"}')).toEqual([]);
  });

  it("drops non-string items and empties", () => {
    expect(
      parseSearchTerms('{"terms": ["react", 42, null, "", "css"]}'),
    ).toEqual(["react", "css"]);
  });

  it("normalizes whitespace and deduplicates case-insensitively", () => {
    expect(
      parseSearchTerms(
        '{"terms": ["React  Performance", "react performance"]}',
      ),
    ).toEqual(["React Performance"]);
  });

  it("caps term length at 50 characters", () => {
    const long = "a".repeat(80);
    const result = parseSearchTerms(`{"terms": ["${long}"]}`);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(50);
  });

  it("caps the number of terms", () => {
    const terms = Array.from({ length: 20 }, (_, i) => `term${i}`);
    expect(parseSearchTerms(JSON.stringify({ terms }))).toHaveLength(
      MAX_SEARCH_TERMS,
    );
  });
});

describe("interpretSearchQueryRepo", () => {
  it("returns terms from the injected generator", async () => {
    const result = await interpretSearchQueryRepo(
      USER,
      { query: "find my bookmarks about React performance" },
      countingGenerator,
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.terms).toEqual(["react", "performance"]);
    }
  });

  it("rejects an empty query without calling AI", async () => {
    const result = await interpretSearchQueryRepo(
      USER,
      { query: "   " },
      mustNotCallGenerator,
    );
    expect(result.success).toBe(false);
  });

  it("rejects an oversized query without calling AI", async () => {
    const result = await interpretSearchQueryRepo(
      USER,
      { query: "x".repeat(201) },
      mustNotCallGenerator,
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).not.toContain("200");
    }
  });

  it("falls back to empty terms (client falls back to FTS) on provider failure", async () => {
    // parseSearchTerms never sees a throw — the repo catches it.
    const result = await interpretSearchQueryRepo(
      USER,
      { query: "react" },
      failingGenerator,
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Failed to interpret search query");
      expect(result.error).not.toContain("provider");
    }
  });

  it("enforces the shared daily rate limit", async () => {
    let limited = false;
    for (let i = 0; i < 20; i++) {
      const result = await interpretSearchQueryRepo(
        USER,
        { query: "react" },
        countingGenerator,
      );
      if (!result.success && result.error.includes("Rate limit")) {
        limited = true;
        break;
      }
      expect(result.success).toBe(true);
    }
    expect(limited).toBe(true);
  });
});
