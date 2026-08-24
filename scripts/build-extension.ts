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
  resolve(EXT_DIR, "popup.ts"),
  resolve(EXT_DIR, "options.ts"),
  resolve(EXT_DIR, "queue.ts"),
  resolve(EXT_DIR, "storage.ts"),
  resolve(EXT_DIR, "constants.ts"),
  resolve(EXT_DIR, "x-capture.ts"),
  resolve(EXT_DIR, "auth-bridge.ts"),
];

if (existsSync(OUT_DIR)) {
  rmSync(OUT_DIR, { recursive: true });
}

const config: esbuild.BuildOptions = {
  entryPoints,
  outdir: OUT_DIR,
  // Bundle each entry with its dependencies (e.g. zod) inlined: Chrome
  // extension scripts resolve only explicit file URLs, not bare module names.
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "esnext",
  sourcemap: false,
  minify: true,
};

const watch = process.argv.includes("--watch");

async function main() {
  if (watch) {
    const ctx = await esbuild.context(config);
    await ctx.watch();
    logger.info("Watching extension for changes...");
  } else {
    await esbuild.build(config);
    logger.info("Extension built to extension/dist/");
  }
}

main().catch((error) => logger.error("Build failed", { error }));
