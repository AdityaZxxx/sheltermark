import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

import { parseImportFile } from "~/lib/import/parsers";

const fixturesDir = path.join(import.meta.dirname, "fixtures");

function loadFixture(name: string): string {
  return readFileSync(path.join(fixturesDir, name), "utf-8");
}

describe("parseImportFile dispatcher", () => {
  describe("JSON path", () => {
    it("parses Sheltermark JSON with workspaces", () => {
      const json = JSON.stringify({
        workspaces: [
          {
            name: "WS1",
            bookmarks: [
              { url: "https://a.com/", title: "A" },
              { url: "https://b.com/", title: "B" },
            ],
          },
        ],
      });
      const result = parseImportFile(json, "json");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.bookmarks).toHaveLength(2);
      }
    });

    it("parses flat JSON", () => {
      const json = JSON.stringify({
        bookmarks: [{ url: "https://a.com/", title: "A" }],
      });
      const result = parseImportFile(json, "json");
      expect(result.success).toBe(true);
    });

    it("returns error on invalid JSON", () => {
      const result = parseImportFile("{ not json", "json");
      expect(result.success).toBe(false);
    });
  });

  describe("CSV path", () => {
    it("parses CSV with url and title columns", () => {
      const csv = "url,title\nhttps://a.com/,A\nhttps://b.com/,B\n";
      const result = parseImportFile(csv, "csv");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.bookmarks).toHaveLength(2);
      }
    });

    it("returns error when url column missing", () => {
      const csv = "title\nFoo\n";
      const result = parseImportFile(csv, "csv");
      expect(result.success).toBe(false);
    });
  });

  describe("Netscape path", () => {
    it("parses Netscape bookmarks.html via dispatcher", () => {
      const content = loadFixture("chrome-export.html");
      const result = parseImportFile(content, "netscape");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.bookmarks.length).toBeGreaterThan(0);
        // folderPath should be present on at least one bookmark
        const withFolder = result.bookmarks.find(
          (b) => b.folderPath && b.folderPath.length > 0,
        );
        expect(withFolder).toBeDefined();
      }
    });

    it("returns error for non-Netscape content", () => {
      const result = parseImportFile("<html></html>", "netscape");
      expect(result.success).toBe(false);
    });
  });
});
