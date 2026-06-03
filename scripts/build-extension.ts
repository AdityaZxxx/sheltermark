/**
 * Build extension TypeScript files to extension/dist/*.js
 * Usage: bun run scripts/build-extension.ts [--watch]
 */

import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import * as esbuild from "esbuild";

const ROOT = resolve(import.meta.dirname, "..");
const EXT_DIR = resolve(ROOT, "extension");
const OUT_DIR = resolve(EXT_DIR, "dist");

const entryPoints = [
  resolve(EXT_DIR, "background.ts"),
  resolve(EXT_DIR, "popup.ts"),
  resolve(EXT_DIR, "options.ts"),
  resolve(EXT_DIR, "storage.ts"),
  resolve(EXT_DIR, "constants.ts"),
  resolve(EXT_DIR, "x-capture.ts"),
];

if (existsSync(OUT_DIR)) {
  rmSync(OUT_DIR, { recursive: true });
}

const config: esbuild.BuildOptions = {
  entryPoints,
  outdir: OUT_DIR,
  bundle: false, // keep separate files (Chrome extension needs them separate)
  format: "esm",
  target: "esnext",
  sourcemap: false,
  minify: false,
};

const watch = process.argv.includes("--watch");

async function main() {
  if (watch) {
    const ctx = await esbuild.context(config);
    await ctx.watch();
    console.log("[ext:watch] Watching for changes...");
  } else {
    await esbuild.build(config);
    console.log("[ext:build] Built extension to extension/dist/");
  }
}

main().catch(console.error);
