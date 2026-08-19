import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

import { parseNetscapeHTML } from "~/lib/import/netscape";

const fixturesDir = path.join(import.meta.dirname, "fixtures");

function loadFixture(name: string): string {
  return readFileSync(path.join(fixturesDir, name), "utf-8");
}

describe("parseNetscapeHTML", () => {
  describe("Chrome export fixture", () => {
    const result = parseNetscapeHTML(loadFixture("chrome-export.html"));

    it("parses successfully", () => {
      expect(result.success).toBe(true);
    });

    it("extracts all valid bookmarks (excluding rejected schemes)", () => {
      if (!result.success) throw new Error("expected success");
      // chrome fixture contents:
      //   Bookmarks bar: react.dev, nextjs.org/docs, typescriptlang.org,
      //                   rust-lang.org, tanstack.com, tailwindcss.com = 6
      //   Other bookmarks: example.com/article, www.example.org/page,
      //                   example.com/empty-title, example.com/url-as-title = 4
      //                   (javascript: and data: rejected)
      //   Empty folder contributes 0
      // Total: 10
      expect(result.bookmarks).toHaveLength(10);
    });

    it("preserves folder hierarchy on each bookmark", () => {
      if (!result.success) throw new Error("expected success");
      const reactBm = result.bookmarks.find(
        (b) => b.url === "https://react.dev/",
      );
      expect(reactBm?.folderPath).toEqual(["Bookmarks bar"]);

      const tsBm = result.bookmarks.find(
        (b) => b.url === "https://typescriptlang.org/",
      );
      expect(tsBm?.folderPath).toEqual(["Bookmarks bar", "Programming"]);

      const tailwindBm = result.bookmarks.find(
        (b) => b.url === "https://tailwindcss.com/",
      );
      expect(tailwindBm?.folderPath).toEqual([
        "Bookmarks bar",
        "Programming",
        "Frontend",
      ]);
    });

    it("rejects javascript: URLs", () => {
      if (!result.success) throw new Error("expected success");
      const jsBookmark = result.bookmarks.find((b) =>
        b.url.startsWith("javascript:"),
      );
      expect(jsBookmark).toBeUndefined();
    });

    it("rejects data: URLs", () => {
      if (!result.success) throw new Error("expected success");
      const dataBookmark = result.bookmarks.find((b) =>
        b.url.startsWith("data:"),
      );
      expect(dataBookmark).toBeUndefined();
    });

    it("extracts embedded favicon data URLs from ICON attribute", () => {
      if (!result.success) throw new Error("expected success");
      const reactBm = result.bookmarks.find(
        (b) => b.url === "https://react.dev/",
      );
      expect(reactBm?.favicon_url).toBeDefined();
      expect(reactBm?.favicon_url).toMatch(/^data:image\/png;base64,/);
    });

    it("preserves empty title (URL only)", () => {
      if (!result.success) throw new Error("expected success");
      const emptyTitleBm = result.bookmarks.find(
        (b) => b.url === "https://example.com/empty-title",
      );
      expect(emptyTitleBm?.title).toBe("");
    });

    it("preserves URL-as-title literally", () => {
      if (!result.success) throw new Error("expected success");
      const urlTitleBm = result.bookmarks.find(
        (b) => b.url === "https://example.com/url-as-title",
      );
      expect(urlTitleBm?.title).toBe("https://example.com/url-as-title");
    });

    it("ignores separators (HR)", () => {
      if (!result.success) throw new Error("expected success");
      // HR doesn't carry a URL; should not appear in output.
      const separators = result.bookmarks.filter((b) => b.title === "HR");
      expect(separators).toHaveLength(0);
    });

    it("ignores empty folders", () => {
      if (!result.success) throw new Error("expected success");
      // Empty folder "Empty folder" contributes 0 bookmarks
      const emptyFolderBookmarks = result.bookmarks.filter((b) =>
        b.folderPath?.includes("Empty folder"),
      );
      expect(emptyFolderBookmarks).toHaveLength(0);
    });
  });

  describe("Firefox export fixture", () => {
    const result = parseNetscapeHTML(loadFixture("firefox-export.html"));

    it("parses successfully", () => {
      expect(result.success).toBe(true);
    });

    it("extracts bookmarks including top-level ones (no folder)", () => {
      if (!result.success) throw new Error("expected success");
      expect(result.bookmarks).toHaveLength(3);
      const topLevel = result.bookmarks.find(
        (b) => b.url === "https://example.com/no-folder",
      );
      expect(topLevel).toBeDefined();
      // Top-level bookmarks have no folderPath
      expect(topLevel?.folderPath).toBeUndefined();
    });
  });

  describe("Malformed HTML fixture", () => {
    const result = parseNetscapeHTML(loadFixture("malformed-export.html"));

    it("parses successfully despite truncation", () => {
      expect(result.success).toBe(true);
    });

    it("recovers valid bookmarks from truncated content", () => {
      if (!result.success) throw new Error("expected success");
      // The first OK bookmark should be present; nested ones may or may not
      // be recovered depending on parse5's leniency.
      const ok = result.bookmarks.find(
        (b) => b.url === "https://ok.example.com/",
      );
      expect(ok).toBeDefined();
    });
  });

  describe("Edge cases", () => {
    it("rejects content missing the NETSCAPE marker", () => {
      const result = parseNetscapeHTML(
        "<html><body>not a bookmark file</body></html>",
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/NETSCAPE-Bookmark-file-1/);
      }
    });

    it("returns error when file has only folders and separators", () => {
      const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3>Folder 1</H3>
  <DL><p></DL><p>
  <DT><H3>Folder 2</H3>
  <DL><p></DL><p>
  <HR>
</DL><p>`;
      const result = parseNetscapeHTML(html);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/No bookmarks/);
      }
    });

    it("handles bookmarks with no title attribute", () => {
      const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><A HREF="https://no-title.example.com/"></A>
</DL><p>`;
      const result = parseNetscapeHTML(html);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.bookmarks[0]?.title).toBe("");
        expect(result.bookmarks[0]?.url).toBe("https://no-title.example.com/");
      }
    });

    it("handles HTML entities in titles", () => {
      const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><A HREF="https://entities.example.com/">Tom & Jerry "Cartoon"</A>
</DL><p>`;
      const result = parseNetscapeHTML(html);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.bookmarks[0]?.title).toBe('Tom & Jerry "Cartoon"');
      }
    });

    it("skips oversized embedded favicons (over 64KB)", () => {
      // Construct a data URL > 64KB
      const bigData = `data:image/png;base64,${"A".repeat(70_000)}`;
      const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><A HREF="https://big-icon.example.com/" ICON="${bigData}">Title</A>
</DL><p>`;
      const result = parseNetscapeHTML(html);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.bookmarks[0]?.favicon_url).toBeUndefined();
      }
    });

    it("keeps small embedded favicons (under 64KB)", () => {
      const smallData = `data:image/png;base64,${"A".repeat(100)}`;
      const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><A HREF="https://small-icon.example.com/" ICON="${smallData}">Title</A>
</DL><p>`;
      const result = parseNetscapeHTML(html);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.bookmarks[0]?.favicon_url).toBe(smallData);
      }
    });

    it("rejects malformed URLs (caught by URL constructor)", () => {
      const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><A HREF="not-a-url">Title</A>
</DL><p>`;
      const result = parseNetscapeHTML(html);
      expect(result.success).toBe(false);
      if (result.success) {
        expect(result.bookmarks).toHaveLength(0);
      }
    });

    it("handles deeply nested folders", () => {
      const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3>L1</H3>
  <DL><p>
    <DT><H3>L2</H3>
    <DL><p>
      <DT><H3>L3</H3>
      <DL><p>
        <DT><H3>L4</H3>
        <DL><p>
          <DT><H3>L5</H3>
          <DL><p>
            <DT><A HREF="https://deep.example.com/">Deep</A>
          </DL><p>
        </DL><p>
      </DL><p>
    </DL><p>
  </DL><p>
</DL><p>`;
      const result = parseNetscapeHTML(html);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.bookmarks[0]?.folderPath).toEqual([
          "L1",
          "L2",
          "L3",
          "L4",
          "L5",
        ]);
      }
    });
  });
});
