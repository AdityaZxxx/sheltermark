import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Guard: public/vendor/pdf.worker.min.mjs must stay pinned to the installed
// pdfjs-dist version. The worker is loaded by the client viewer from our
// origin (CDN would be a third-party dependency at runtime); if the dep is
// upgraded without refreshing the vendored copy, the viewer breaks in
// confusing ways. Drift = stale worker vs a newer library, or vice versa.
const WORKER_PATH = join(
  import.meta.dir,
  "../../public/vendor/pdf.worker.min.mjs",
);
const PACKAGE_JSON = readFileSync(
  join(import.meta.dir, "../../package.json"),
  "utf8",
);

describe("vendored pdf.js worker", () => {
  it("exists and is non-empty", () => {
    const stat = statSync(WORKER_PATH);
    expect(stat.size).toBeGreaterThan(100_000);
  });

  it("vendored assets match the pinned pdfjs-dist version", () => {
    const lock = JSON.parse(PACKAGE_JSON);
    const version = lock.dependencies["pdfjs-dist"];
    expect(version).toBeTruthy();
    // Exact pin required: the drift assertion compares the vendored worker
    // against this version, so a range would silently skip the guard.
    expect(/^\d+\.\d+\.\d+$/.test(version)).toBe(true);
    const worker = readFileSync(WORKER_PATH, "utf8");
    const embedded = worker.match(/pdfjsVersion\s*=\s*([\d.]+)/)?.[1];
    expect(embedded).toBe(version);
  });

  it("cmaps and standard fonts are vendored (CJK/legacy PDF support)", () => {
    const cmaps = join(import.meta.dir, "../../public/vendor/pdf-cmaps");
    const fonts = join(
      import.meta.dir,
      "../../public/vendor/pdf-standard-fonts",
    );
    expect(readdirSync(cmaps).length).toBeGreaterThan(100);
    expect(readdirSync(fonts).length).toBeGreaterThan(10);
  });
});
