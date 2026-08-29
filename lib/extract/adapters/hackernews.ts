import * as cheerio from "cheerio";

import type { DomAdapter } from "./types";

// Item pages only (/item?id=…) — the front page and other HN routes render
// as a list, which the adapter does not model.
export function isHackerNewsItem(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url);
    return hostname === "news.ycombinator.com" && pathname === "/item";
  } catch {
    return false;
  }
}

// HN item pages are table-based and ancient; Readability chokes on them. Pull
// the story (title/author/text if a self-post) plus comment rows directly.
export const hackerNewsAdapter: DomAdapter = {
  name: "hackernews",
  kind: "dom",
  matches: isHackerNewsItem,
  adapt: (html, url) => {
    const $ = cheerio.load(html);
    const titleRow = $(".athing .titleline > a").first();
    if (titleRow.length === 0) return null;

    const storyTitle = titleRow.text().trim();
    const storyUrl = titleRow.attr("href") ?? url;
    const author = $(".subtext a.hnuser").first().text().trim();

    const comments: string[] = [];
    $(".commtext").each((_, el) => {
      if (comments.length >= 30) return;
      const row = $(el).closest("tr");
      const who = row.find(".hnuser").first().text().trim();
      const indent = row.find(".ind").attr("indent");
      const pad = indent ? `${Number.parseInt(indent) / 40}rem` : "0rem";
      const body = $(el).html()?.trim();
      if (body) {
        comments.push(
          `<p style="margin-left:${pad}"><strong>${who}</strong><br>${body}</p>`,
        );
      }
    });

    const selfText = $(".toptext").first().html()?.trim();

    return {
      title: storyTitle,
      byline: author || null,
      siteName: "Hacker News",
      excerpt: null,
      html: [
        selfText ? `<p>${selfText}</p>` : "",
        `<p><a href="${storyUrl}">${storyUrl}</a></p>`,
        ...comments,
      ].join(""),
      length: storyTitle.length + comments.join("").length,
      url,
    };
  },
};
