import { describe, expect, it } from "bun:test";

import { detectFormat, formatDisplayName } from "~/lib/import/detect";

describe("detectFormat", () => {
  describe("JSON detection", () => {
    it("detects JSON object", () => {
      expect(detectFormat('{"workspaces": []}')).toBe("json");
    });

    it("detects JSON array", () => {
      expect(detectFormat("[]")).toBe("json");
    });

    it("detects JSON with leading whitespace", () => {
      expect(detectFormat('   \n  {"workspaces": []}')).toBe("json");
    });
  });

  describe("Netscape detection", () => {
    it("detects Netscape bookmark file via magic signature", () => {
      const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<DL><p></DL><p>`;
      expect(detectFormat(html)).toBe("netscape");
    });

    it("detects Netscape even without DOCTYPE", () => {
      const html = `<!-- NETSCAPE-Bookmark-file-1 -->\n<DL><p></DL><p>`;
      expect(detectFormat(html)).toBe("netscape");
    });

    it("detects Netscape when marker is deep in first 1KB", () => {
      const padding = "x".repeat(500);
      const html = `<!DOCTYPE html>\n${padding}\nNETSCAPE-Bookmark-file-1\n<DL></DL>`;
      expect(detectFormat(html)).toBe("netscape");
    });

    it("does NOT detect Netscape when marker is past 1KB", () => {
      const padding = "x".repeat(1500);
      const html = `<!DOCTYPE html>\n${padding}\nNETSCAPE-Bookmark-file-1\n<DL></DL>`;
      // Past 1KB, the marker is invisible to the detector — falls through
      // to other heuristics.
      expect(detectFormat(html)).not.toBe("netscape");
    });
  });

  describe("CSV detection", () => {
    it("detects CSV by comma in first line + multiple lines", () => {
      expect(detectFormat("url,title\nhttps://example.com,Title")).toBe("csv");
    });

    it("does NOT classify a single-line string with comma as CSV", () => {
      // Single line with comma doesn't pass the multi-line check
      expect(detectFormat("just, one line")).toBe("unknown");
    });
  });

  describe("Unknown format", () => {
    it("returns 'unknown' for plain text", () => {
      expect(detectFormat("hello world")).toBe("unknown");
    });

    it("returns 'unknown' for empty content", () => {
      expect(detectFormat("")).toBe("unknown");
    });

    it("returns 'unknown' for whitespace-only content", () => {
      expect(detectFormat("   \n\n  \t")).toBe("unknown");
    });

    it("returns 'unknown' for HTML that isn't a bookmark file", () => {
      expect(detectFormat("<html><body>blog post</body></html>")).toBe(
        "unknown",
      );
    });
  });
});

describe("formatDisplayName", () => {
  it("returns human-readable name for json", () => {
    expect(formatDisplayName("json")).toBe("Sheltermark JSON");
  });

  it("returns human-readable name for csv", () => {
    expect(formatDisplayName("csv")).toBe("Sheltermark CSV");
  });

  it("returns human-readable name for netscape", () => {
    expect(formatDisplayName("netscape")).toBe("Browser bookmarks (HTML)");
  });

  it("returns human-readable name for unknown", () => {
    expect(formatDisplayName("unknown")).toBe("Unknown format");
  });
});
