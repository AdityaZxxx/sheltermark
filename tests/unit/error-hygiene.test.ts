import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_DIR = join(
  import.meta.dir,
  "..",
  "..",
  "lib",
  "data",
  "repositories",
);

// Source-level contract: raw infrastructure messages must never be assigned
// into ActionResult error fields. The sanitizers (dbError/supabaseError/
// invalidData) are the only sanctioned path from a caught cause to an
// `error:` field; deliberate domain messages are plain string literals.
const BANNED_PATTERNS: Array<[RegExp, string]> = [
  [
    /error:\s*[`"']?[^\n]*\.(message|detail|hint)\b(?!\s*\))/,
    "raw `.message`/`.detail`/`.hint` interpolated into an error field",
  ],
  [
    /instanceof Error \? \w+\.message/,
    "`instanceof Error ? x.message` ternary leaking driver text",
  ],
];

function repositoryFiles(): string[] {
  return readdirSync(REPO_DIR)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => join(REPO_DIR, f));
}

describe("error hygiene contract", () => {
  it("repositories never place raw infra messages into error fields", () => {
    const violations: string[] = [];
    for (const file of repositoryFiles()) {
      const source = readFileSync(file, "utf8");
      const lines = source.split("\n");
      lines.forEach((line, i) => {
        for (const [pattern, why] of BANNED_PATTERNS) {
          if (pattern.test(line)) {
            violations.push(`${file}:${i + 1} — ${why}: ${line.trim()}`);
          }
        }
      });
    }
    expect(violations).toEqual([]);
  });
});
