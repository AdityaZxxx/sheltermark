import { describe, expect, it } from "bun:test";

import {
  bookmarkSurvivesFilter,
  FOLDER_PATH_SEPARATOR,
  filterByFolders,
  pathKey,
} from "~/lib/import/folder-filter";

const SEP = FOLDER_PATH_SEPARATOR;

const bms = [
  { url: "https://a.com/", folderPath: ["Bookmarks bar", "Programming"] },
  { url: "https://b.com/", folderPath: ["Bookmarks bar", "Reading"] },
  { url: "https://c.com/", folderPath: ["Other bookmarks"] },
  { url: "https://d.com/", folderPath: undefined },
];

describe("pathKey", () => {
  it("joins segments with NUL separator", () => {
    expect(pathKey(["a", "b", "c"])).toBe(`a${SEP}b${SEP}c`);
  });

  it("returns empty string for empty path", () => {
    expect(pathKey([])).toBe("");
  });
});

describe("bookmarkSurvivesFilter", () => {
  it("requires the empty-path key for top-level bookmarks", () => {
    const sel = new Set([""]);
    expect(bookmarkSurvivesFilter(undefined, sel)).toBe(true);
    expect(bookmarkSurvivesFilter([], sel)).toBe(true);
  });

  it("rejects top-level bookmarks when empty-path key is absent", () => {
    const sel = new Set([`Bookmarks bar`]);
    expect(bookmarkSurvivesFilter(undefined, sel)).toBe(false);
    expect(bookmarkSurvivesFilter([], sel)).toBe(false);
  });

  it("requires every ancestor folder to be selected", () => {
    // Selecting only the leaf is not enough — ancestor must also be selected.
    const selLeafOnly = new Set([`Bookmarks bar${SEP}Programming`]);
    expect(
      bookmarkSurvivesFilter(["Bookmarks bar", "Programming"], selLeafOnly),
    ).toBe(false);

    const selBoth = new Set([
      `Bookmarks bar`,
      `Bookmarks bar${SEP}Programming`,
    ]);
    expect(
      bookmarkSurvivesFilter(["Bookmarks bar", "Programming"], selBoth),
    ).toBe(true);
    expect(bookmarkSurvivesFilter(["Bookmarks bar", "Reading"], selBoth)).toBe(
      false,
    );
  });

  it("accepts bookmarks at the selected folder exactly", () => {
    const sel = new Set([`Bookmarks bar`]);
    expect(bookmarkSurvivesFilter(["Bookmarks bar"], sel)).toBe(true);
  });
});

describe("filterByFolders", () => {
  it("filters to selected-folder subtree", () => {
    const sel = new Set([`Bookmarks bar`, `Bookmarks bar${SEP}Programming`]);
    const result = filterByFolders(bms, sel);
    expect(result).toHaveLength(1);
    expect(result[0]?.url).toBe("https://a.com/");
  });

  it("returns empty array when nothing matches", () => {
    const sel = new Set([`Nowhere`]);
    expect(filterByFolders(bms, sel)).toHaveLength(0);
  });

  it("includes top-level bookmarks when empty-path key is selected", () => {
    const sel = new Set([``, `Bookmarks bar`]);
    const result = filterByFolders(bms, sel);
    expect(result.map((b) => b.url)).toContain("https://d.com/");
  });

  it("excludes top-level bookmarks when empty-path key is not selected", () => {
    const sel = new Set([`Bookmarks bar`]);
    const result = filterByFolders(bms, sel);
    expect(result.map((b) => b.url)).not.toContain("https://d.com/");
  });

  it("does not mutate input", () => {
    const sel = new Set([`Bookmarks bar${SEP}Programming`]);
    const before = [...bms];
    filterByFolders(bms, sel);
    expect(bms).toEqual(before);
  });
});
