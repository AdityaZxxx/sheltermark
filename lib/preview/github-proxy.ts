import * as cheerio from "cheerio";

import { isSafeUrl } from "~/lib/metadata/fetch";
import { httpFetch, readResponseBody } from "~/lib/utils/http-fetch";

// GitHub native-render proxy (ADR-0007). GitHub serves XFO deny, so we
// re-serve its public HTML from our origin in a script-less sandboxed
// iframe — the same approach Raindrop's preview.systems uses (verified
// against their production proxy, 2026-08-29): their output keeps GitHub's
// DOM byte-intact except for (a) every GitHub <script> removed, (b) a
// <base href> injected, (c) a small overlay. GitHub's UI renders natively
// from its CSS alone — the React-only parts (AppHeader, file tree) simply
// stay as their hidden/fallback no-JS state, which looks like a clean
// logged-out GitHub page.
//
// We intentionally do NOT run a class/attribute allowlist pass here: the
// native look depends on GitHub's markup surviving intact, and breaking
// any structural attribute re-opens hidden fallback content (e.g. the
// "Uh oh!" box, which GitHub keeps hidden via its own `hidden` attr).
// Security instead comes from: script removal (below), CSP with
// script-src 'none', and the iframe sandbox without allow-scripts.

const MAX_PROXY_HTML_BYTES = 2 * 1024 * 1024;
const GITHUB_HOST = "github.com";

export type GithubProxyResult =
  | { ok: true; html: string; title: string; url: string }
  | { ok: false; reason: "unsafe-url" | "fetch-failed" | "not-github" };

export function isGithubUrl(url: string): boolean {
  try {
    const u = new URL(url);
    // gist.github.com is GitHub's own host; everything else (including
    // look-alikes) is rejected. https-only: the fetch pipeline refuses
    // http anyway, and failing here is cheaper.
    if (u.protocol !== "https:") return false;
    return u.hostname === GITHUB_HOST || u.hostname === "gist.github.com";
  } catch {
    return false;
  }
}

export async function buildGithubProxyDocument(
  url: string,
): Promise<GithubProxyResult> {
  if (!isGithubUrl(url)) return { ok: false, reason: "not-github" };
  if (!(await isSafeUrl(url))) return { ok: false, reason: "unsafe-url" };

  const fetched = await fetchGithubHtml(url);
  if (!fetched) return { ok: false, reason: "fetch-failed" };

  const doc = transformGithubHtml(fetched.html, fetched.finalUrl);
  if (!doc) return { ok: false, reason: "fetch-failed" };

  return { ok: true, ...doc };
}

async function fetchGithubHtml(
  url: string,
): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const { response, finalUrl } = await httpFetch(url, {
      followRedirect: { maxHops: 5 },
      onRedirectHop: isSafeUrl,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        // logged-out render, matching what an anonymous visitor gets
      },
    });
    if (!response.ok) return null;
    const html = await readResponseBody(response, MAX_PROXY_HTML_BYTES);
    return { html, finalUrl };
  } catch {
    return null;
  }
}

// Small overlay appended to <head>. GitHub's no-JS state is mostly clean;
// we only hide the bits that are visibly broken without scripts and
// constrain the page to the pane width.
const OVERLAY_CSS = `
/* Native GitHub render, script-less state polish (ADR-0007). */
/* Hide JS-dependent fallback notices GitHub would have replaced. */
[data-show-on-forbidden-error],
.js-unless-platform,
[data-hide-on-error],
.js-flash-container,
.js-notification-shelf,
.include-fragment-error,
.uh-oh-notice,
[data-target="unread-banner"] { display: none !important; }
/* The lazy "HeaderMenu" mega-nav dump is a no-JS fallback; hide the nav
   panels but keep the compact header bar itself. */
.HeaderMenu-details { display: none !important; }
/* Popovers/dialogs that CSS alone leaves half-open without JS. */
details-menu:not([open]),
details > summary + .dropdown-menu { visibility: hidden; }
details[open] > .dropdown-menu { visibility: visible; }
/* Keep the repo page inside the preview pane; GitHub is wide-first. */
body { min-width: 0 !important; }
@media (min-width: 768px) { .container-lg { max-width: 100% !important; } }
`;

// Pure DOM transform + assembly, exported for fixture tests. Mirrors the
// verified Raindrop recipe: intact DOM, scripts stripped, base injected,
// URLs absolutized, overlay appended.
export function transformGithubHtml(
  html: string,
  finalUrl: string,
): { html: string; title: string; url: string } | null {
  const $ = cheerio.load(html);

  // 1. Remove ALL scripts (first-party included — GitHub's own static.js
  //    equivalent runs nothing here). Keep <template>, keep hidden attrs,
  //    keep data-* — the DOM must survive intact or fallback content leaks
  //    into view.
  $("script").remove();
  $("noscript").each((_, el) => {
    // cheerio treats noscript content as a raw text child (scripting
    // enabled), so re-parse it and splice the nodes back in: they are
    // GitHub's no-JS fallback (avatars, sprites) and must render here.
    const $el = $(el);
    const fallback = $el.text();
    if (fallback.trim()) {
      $el.replaceWith(fallback);
    } else {
      $el.remove();
    }
  });

  // 2. Drop frames/embeds/forms — read-only preview, same as Raindrop.
  $("iframe, object, embed, form").remove();
  $("meta[http-equiv]").remove();

  // 3. Base injection (Raindrop does exactly this). A pre-existing base is
  //    replaced so attacker-relative URLs resolve against the real origin.
  $("head base").remove();
  $("head").prepend(
    `<base href="${finalUrl}" target="_blank">` +
      `<style>${OVERLAY_CSS}</style>`,
  );

  // 4. Absolutize all URLs against the source so nothing resolves against
  //    our origin, and force safe external navigation.
  absolutizeAttrs($, finalUrl);
  $("a").each((_, el) => {
    const $el = $(el);
    const href = $el.attr("href");
    if (href === undefined || href === "" || href === "#") return;
    $el.attr("rel", "noopener noreferrer");
    $el.attr("target", "_blank");
  });

  const title =
    $("head title").first().text().trim() ||
    $("title").first().text().trim() ||
    finalUrl;

  const out = $.html();
  if (!out || !out.includes("<body")) return null;
  return { html: out, title, url: finalUrl };
}

// Resolve href/src/srcset against the source URL. A bare "#" stays put.
function absolutizeAttrs($: cheerio.CheerioAPI, base: string): void {
  const resolve = (value: string | undefined): string | undefined => {
    if (!value || value === "#") return value;
    try {
      return new URL(value, base).toString();
    } catch {
      return undefined;
    }
  };

  $("[href]").each((_, el) => {
    const $el = $(el);
    const resolved = resolve($el.attr("href"));
    if (resolved) $el.attr("href", resolved);
  });
  $("[src]").each((_, el) => {
    const $el = $(el);
    const resolved = resolve($el.attr("src"));
    if (resolved) $el.attr("src", resolved);
  });
  $("[srcset]").each((_, el) => {
    const $el = $(el);
    const srcset = $el.attr("srcset");
    if (!srcset) return;
    const rewritten = srcset
      .split(",")
      .map((part) => {
        const seg = part.trim().split(/\s+/);
        const resolved = resolve(seg[0]);
        if (!resolved) return null;
        return [resolved, ...seg.slice(1)].join(" ");
      })
      .filter((part): part is string => part !== null)
      .join(", ");
    $el.attr("srcset", rewritten);
  });
  $("[data-src]:not([src])").each((_, el) => {
    // GitHub lazy-loads via data-src; scripts are gone, so promote it.
    const $el = $(el);
    const resolved = resolve($el.attr("data-src"));
    if (resolved) $el.attr("src", resolved);
  });
  $("[data-srcset]:not([srcset])").each((_, el) => {
    const $el = $(el);
    const srcset = $el.attr("data-srcset");
    if (!srcset) return;
    const rewritten = srcset
      .split(",")
      .map((part) => {
        const seg = part.trim().split(/\s+/);
        const resolved = resolve(seg[0]);
        if (!resolved) return null;
        return [resolved, ...seg.slice(1)].join(" ");
      })
      .filter((part): part is string => part !== null)
      .join(", ");
    $el.attr("srcset", rewritten);
  });
}

// Response CSP for the script-less native document: GitHub's own origins
// are the only external loads allowed — stylesheets from the GitHub CDN,
// images from GitHub's asset/avatar hosts. Everything else must be inline.
export const PROXY_CSP = [
  "default-src 'none'",
  "style-src 'self' 'unsafe-inline' https://github.githubassets.com",
  "img-src 'self' data: https://github.githubassets.com https://*.githubusercontent.com https://github.com https://avatars.githubusercontent.com https://identicons.github.com https://camo.githubusercontent.com",
  "font-src https://github.githubassets.com data:",
  "form-action 'none'",
  "frame-ancestors 'self'",
  "base-uri 'none'",
  "script-src 'none'",
].join("; ");
