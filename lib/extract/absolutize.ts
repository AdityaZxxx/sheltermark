import * as cheerio from "cheerio";

// Relative hrefs/srcs in extracted HTML would resolve against OUR origin
// (localhost:3000/api/...) inside the preview iframe. Rewrite them against
// the source article URL. Pure `#fragment` anchors stay relative so in-page
// navigation still works inside the preview.
export function absolutize(html: string, baseUrl: string): string {
  const $ = cheerio.load(`<div id="__root">${html}</div>`);
  const root = $("#__root");

  root.find("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.startsWith("#")) return;
    try {
      $(el).attr("href", new URL(href, baseUrl).toString());
    } catch {
      // leave unchanged if unresolvable
    }
  });

  root.find("img[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (!src) return;
    try {
      $(el).attr("src", new URL(src, baseUrl).toString());
    } catch {
      // leave unchanged if unresolvable
    }
  });

  return root.html() ?? html;
}
