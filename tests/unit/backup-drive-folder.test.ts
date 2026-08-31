import { describe, expect, it } from "bun:test";
import "dotenv/config";
import { mock } from "bun:test";
mock.module("server-only", () => ({}));

/**
 * Duplicate "Sheltermark" folders are the steady state on Google Drive
 * after repeated OAuth consents (drive.file scope). ensureFolder must
 * (a) honor the pinned id when it still exists, and (b) resolve
 * deterministically — newest first — when it doesn't.
 */
const backupFolderId = (parent: string | undefined): string | undefined =>
  parent === "folder-OLD"
    ? "backups-OLD"
    : parent === "folder-NEW"
      ? "backups-NEW"
      : undefined;

function driveWithDuplicates() {
  const requests: string[] = [];
  const folders = [
    { id: "folder-OLD", createdTime: "2026-08-01T00:00:00Z" },
    { id: "folder-NEW", createdTime: "2026-08-30T00:00:00Z" },
  ];
  const existing = new Set([
    "backups-OLD",
    "backups-NEW",
    "folder-OLD",
    "folder-NEW",
    "folder-PINNED",
  ]);
  return {
    requests,
    async fetch(input: RequestInfo | URL, init?: RequestInit) {
      const url = new URL(String(input));
      requests.push(`${init?.method ?? "GET"} ${url.pathname}${url.search}`);
      if (url.hostname !== "www.googleapis.com") {
        return new Response("{}", { status: 200 });
      }
      if (url.pathname === "/drive/v3/files" && init?.method === "POST") {
        return Response.json({ id: "created-folder" });
      }
      const id = url.pathname.match(/\/drive\/v3\/files\/([^/?]+)/)?.[1];
      if (id && !url.searchParams.has("q")) {
        return existing.has(id)
          ? Response.json({ id })
          : new Response("gone", { status: 404 });
      }
      const q = url.searchParams.get("q") ?? "";
      const parent = [...q.matchAll(/'([^']+)' in parents/g)].at(-1)?.[1];
      if (q.includes("name='Sheltermark'")) {
        // Production shape: fields=files(id) — no name in the payload.
        const ordered = url.searchParams.get("orderBy")?.includes("createdTime")
          ? folders.toSorted((a, b) =>
              b.createdTime.localeCompare(a.createdTime),
            )
          : folders;
        return Response.json({
          files: ordered.map((f) => ({ id: f.id })),
        });
      }
      if (q.includes("name='Backups'")) {
        // Production shape: fields=files(id) only.
        const backupId = backupFolderId(parent);
        return Response.json({
          files: backupId ? [{ id: backupId }] : [],
        });
      }
      return Response.json({ files: [] });
    },
  };
}

describe("Google Drive ensureFolder — duplicate-folder regression", () => {
  it("returns the pinned folder id when the folder still exists", async () => {
    const drive = driveWithDuplicates();
    const realFetch = globalThis.fetch;
    // SAFETY: test double matches the fetch signature used by the provider client.
    globalThis.fetch = drive.fetch as typeof fetch;
    try {
      const client = (
        await import("~/lib/backup/providers")
      ).createProviderClient("google_drive", "token");
      const ref = await client.ensureFolder("folder-PINNED");
      expect(ref).toBe("folder-PINNED");
      expect(drive.requests.length).toBe(1);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("resolves deterministically (newest) when unpinned and duplicates exist", async () => {
    const drive = driveWithDuplicates();
    const realFetch = globalThis.fetch;
    // SAFETY: test double matches the fetch signature used by the provider client.
    globalThis.fetch = drive.fetch as typeof fetch;
    try {
      const client = (
        await import("~/lib/backup/providers")
      ).createProviderClient("google_drive", "token");
      const ref = await client.ensureFolder();
      expect(ref).toBe("backups-NEW");
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("does not follow the pinned id when the folder was deleted", async () => {
    const drive = driveWithDuplicates();
    const realFetch = globalThis.fetch;
    // SAFETY: test double matches the fetch signature used by the provider client.
    globalThis.fetch = drive.fetch as typeof fetch;
    try {
      const client = (
        await import("~/lib/backup/providers")
      ).createProviderClient("google_drive", "token");
      const ref = await client.ensureFolder("folder-DELETED");
      expect(ref).toBe("backups-NEW");
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("reuses an existing folder instead of creating duplicates", async () => {
    const drive = driveWithDuplicates();
    const realFetch = globalThis.fetch;
    // SAFETY: test double matches the fetch signature used by the provider client.
    globalThis.fetch = drive.fetch as typeof fetch;
    try {
      const client = (
        await import("~/lib/backup/providers")
      ).createProviderClient("google_drive", "token");
      const ref = await client.ensureFolder();
      expect(ref).toBe("backups-NEW");
      expect(
        drive.requests.filter((r) => r.startsWith("POST")),
        "folder lookups must resolve before any create",
      ).toHaveLength(0);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
