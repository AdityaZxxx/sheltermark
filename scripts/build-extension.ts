/**
 * Build extension TypeScript files to extension/dist/*.js
 * Usage: bun run scripts/build-extension.ts [--watch]
 */

import * as esbuild from "esbuild";
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

import { logger } from "~/lib/utils/logger";

const ROOT = resolve(import.meta.dirname, "..");
const EXT_DIR = resolve(ROOT, "extension");
const OUT_DIR = resolve(EXT_DIR, "dist");

const entryPoints = [
  resolve(EXT_DIR, "background.ts"),
  resolve(EXT_DIR, "popup.tsx"),
  resolve(EXT_DIR, "options.tsx"),
  resolve(EXT_DIR, "queue.ts"),
  resolve(EXT_DIR, "storage.ts"),
  resolve(EXT_DIR, "constants.ts"),
  resolve(EXT_DIR, "x-capture.ts"),
  resolve(EXT_DIR, "auth-bridge.ts"),
];

// Tailwind v4 CSS for the popup/options surfaces. One shared entry; content
// detection is scoped to extension/ via @source in popup.css.
async function buildTailwind(watch: boolean) {
  const args = [
    "@tailwindcss/cli",
    "-i",
    resolve(EXT_DIR, "popup.css"),
    "-o",
    resolve(OUT_DIR, "popup.css"),
  ];
  if (!watch) args.push("--minify");
  if (watch) args.push("--watch");
  const proc = Bun.spawn(["bunx", ...args], {
    stdout: "inherit",
    stderr: "inherit",
  });
  if (!watch && (await proc.exited) !== 0) {
    throw new Error("Tailwind build failed");
  }
}

if (existsSync(OUT_DIR) && !process.argv.includes("--watch")) {
  rmSync(OUT_DIR, { recursive: true });
}

const config: esbuild.BuildOptions = {
  entryPoints,
  outdir: OUT_DIR,
  // Bundle each entry with its dependencies (e.g. zod, react) inlined: Chrome
  // extension scripts resolve only explicit file URLs, not bare module names.
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "esnext",
  jsx: "automatic",
  sourcemap: false,
  minify: true,
};

const watch = process.argv.includes("--watch");

async function main() {
  if (watch) {
    await buildTailwind(true);
    const ctx = await esbuild.context(config);
    await ctx.watch();
    logger.info("Watching extension for changes...");
  } else {
    await Promise.all([buildTailwind(false), esbuild.build(config)]);
    logger.info("Extension built to extension/dist/");
  }
}

main().catch((error) => logger.error("Build failed", { error }));
