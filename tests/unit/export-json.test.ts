import { describe, expect, it } from "bun:test";

import {
  buildCanonicalExport,
  countBookmarksInExport,
  groupBookmarksByWorkspace,
  parseCanonicalExport,
  type ExportBookmarkRow,
} from "~/lib/import/export-json";

const rows: ExportBookmarkRow[] = [
  {
    id: "1",
    url: "https://a.com",
    title: "A",
    favicon_url: null,
    og_image_url: null,
    note: "my note",
    created_at: "2026-08-29T00:00:00Z",
    workspace_id: "w1",
    workspaces: [{ id: "w1", name: "Reading" }],
    tags: ["rust", "docs"],
  },
  {
    id: "2",
    url: "https://b.com",
    title: "B",
    favicon_url: null,
    og_image_url: null,
    note: null,
    created_at: "2026-08-29T01:00:00Z",
    workspace_id: "w2",
    workspaces: [{ id: "w2", name: "Coding" }],
    tags: [],
  },
];

describe("canonical export JSON", () => {
  it("groups by workspace name and keeps note/tags", () => {
    const grouped = groupBookmarksByWorkspace(rows);
    expect(grouped).toHaveLength(2);
    const reading = grouped.find((ws) => ws.name === "Reading");
    expect(reading?.bookmarks[0]?.note).toBe("my note");
    expect(reading?.bookmarks[0]?.tags).toEqual(["rust", "docs"]);
  });

  it("builds version 1.0 export with exportedAt", () => {
    const ex = buildCanonicalExport(rows, new Date("2026-08-29T12:00:00Z"));
    expect(ex.version).toBe("1.0");
    expect(ex.exportedAt).toBe("2026-08-29T12:00:00.000Z");
    expect(countBookmarksInExport(ex)).toBe(2);
  });

  it("round-trips through parseCanonicalExport", () => {
    const ex = buildCanonicalExport(rows);
    const parsed = parseCanonicalExport(JSON.stringify(ex));
    expect(parsed !== null).toBe(true);
    if (parsed) {
      expect(countBookmarksInExport(parsed)).toBe(2);
      expect(parsed.workspaces[0]?.bookmarks[0]?.note).toBe("my note");
    }
  });

  it("rejects non-export JSON", () => {
    expect(parseCanonicalExport("{ not json")).toBeNull();
    expect(parseCanonicalExport('{"bookmarks":[]}')).toBeNull();
    expect(parseCanonicalExport('{"workspaces":"nope"}')).toBeNull();
  });

  it("tolerates bookmarks missing optional fields", () => {
    const minimal = JSON.stringify({
      workspaces: [{ name: "W", bookmarks: [{ url: "https://a.com" }] }],
    });
    const parsed = parseCanonicalExport(minimal);
    expect(parsed !== null).toBe(true);
    if (parsed) {
      expect(parsed.workspaces[0]?.bookmarks[0]?.title).toBeNull();
      expect(parsed.workspaces[0]?.bookmarks[0]?.note).toBeNull();
    }
  });
});
