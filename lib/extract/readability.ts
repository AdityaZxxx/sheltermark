import { Readability } from "@mozilla/readability";
import { createRequire } from "node:module";
import { join } from "node:path";

import type { ExtractedContent } from "./types";

// ponytail: lazy runtime require, not a package-id import — Turbopack
// externalizes package ids into hashed aliases (.next/node_modules/jsdom-<hash>)
// whose symlinks do not survive Vercel's lambda packaging, so any
// `import "jsdom"` crashes at module load in production. Resolving from
// process.cwd() at call time keeps this invisible to Turbopack's static
// analysis; jsdom's dependency tree is force-included via
// outputFileTracingIncludes so it ships in the lambda.
// Revert to `import { JSDOM } from "jsdom"` once Turbopack stops emitting
// hashed-alias externals (vercel/next.js#89851).
type JsdomModule = typeof import("jsdom");
let cached: JsdomModule | null = null;

function loadJsdom(): JsdomModule {
  if (cached === null) {
    // SAFETY: jsdom is a direct dependency pinned in package.json; this
    // requires its main entry from the local install, not user input.
    const jsdomRequire = createRequire(
      join(process.cwd(), "node_modules", "jsdom"),
    );
    const mod = jsdomRequire("jsdom");
    // SAFETY: @types/jsdom declares the exact shape of jsdom's CJS export,
    // and package.json pins the version this assertion is checked against.
    cached = mod as JsdomModule;
  }
  return cached;
}

export function extractArticle(
  html: string,
  url: string,
): ExtractedContent | null {
  const { JSDOM } = loadJsdom();
  const dom = new JSDOM(html, { url });
  const article = new Readability(dom.window.document, {
    charThreshold: 120,
  }).parse();

  return article?.content
    ? {
        title: article.title ?? url,
        byline: article.byline ?? null,
        siteName: article.siteName ?? null,
        excerpt: article.excerpt ?? null,
        html: article.content,
        length: article.textContent?.length ?? 0,
        url,
      }
    : null;
}
