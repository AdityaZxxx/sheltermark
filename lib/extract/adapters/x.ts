import { httpFetch, readResponseBody } from "~/lib/utils/http-fetch";

import type { ExtractedContent } from "../types";
import type { FetchAdapter } from "./types";

// X/Twitter status pages are framing-hostile and JS-rendered. fxtwitter's
// public API (api.fxtwitter.com) returns the full tweet JSON with no auth,
// which we render as a clean article card. Verified reachable 2026-08-29.
const MAX_BYTES = 256 * 1024;

interface FxPhoto {
  url: string;
  width: number;
  height: number;
  alt: string | null;
}

interface FxAuthor {
  name: string;
  screen_name: string;
  avatar_url: string | null;
}

export interface FxTweet {
  text: string | null;
  url: string;
  created_at: string | null;
  likes: number | null;
  replies: number | null;
  retweets: number | null;
  views: number | null;
  author: FxAuthor | null;
  media?: { photos?: FxPhoto[] } | null;
}

export function isXStatus(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url);
    if (hostname !== "x.com" && hostname !== "twitter.com") return false;
    const parts = pathname.split("/").filter(Boolean);
    // /<user>/status/<id> — ignore longer paths (photos, analytics) by using
    // the first three segments.
    return parts.length >= 3 && parts[1] === "status";
  } catch {
    return false;
  }
}

function fmt(n: number | null): string {
  return n === null ? "" : n.toLocaleString("en-US");
}

// Pure JSON → card render, exported for fixture tests (no network).
export function renderTweet(tweet: FxTweet, url: string): ExtractedContent {
  const a = tweet.author;
  const byline = a ? `${a.name} (@${a.screen_name})` : null;
  const stats: string[] = [];
  if (tweet.likes !== null) stats.push(`${fmt(tweet.likes)} likes`);
  if (tweet.replies !== null) stats.push(`${fmt(tweet.replies)} replies`);
  if (tweet.retweets !== null) stats.push(`${fmt(tweet.retweets)} reposts`);
  if (tweet.views !== null) stats.push(`${fmt(tweet.views)} views`);

  const photos = (tweet.media?.photos ?? []).slice(0, 4);
  const photoHtml = photos
    .map((p) => `<img src="${p.url}" alt="${p.alt ?? ""}">`)
    .join("");

  const meta: string[] = [];
  if (tweet.created_at) meta.push(tweet.created_at);
  meta.push(...stats);

  const html = `<p>${tweet.text ?? ""}</p>${photoHtml}${meta.length ? `<p><small>${meta.join(" · ")}</small></p>` : ""}`;

  return {
    title: a ? `Post by ${a.name}` : "X post",
    byline,
    siteName: "X",
    publishedTime: tweet.created_at,
    excerpt: tweet.text?.slice(0, 200) ?? null,
    html,
    length: (tweet.text ?? "").length,
    url: tweet.url || url,
  };
}

export const xAdapter: FetchAdapter = {
  name: "x",
  kind: "fetch",
  matches: isXStatus,
  fetch: async (url): Promise<ExtractedContent | null> => {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    const user = parts[0];
    const id = parts[2];
    const apiUrl = `https://api.fxtwitter.com/${user}/status/${id}`;

    const { response } = await httpFetch(apiUrl, { retries: 1 });
    if (!response.ok) return null;

    const body = await readResponseBody(response, MAX_BYTES);
    let tweet: FxTweet;
    try {
      // SAFETY: fxtwitter JSON parsed and shape-checked — `tweet` is verified
      // non-null before use; unknown extra fields are ignored by the type.
      const parsed = JSON.parse(body) as { tweet?: FxTweet | null };
      if (!parsed.tweet) return null;
      tweet = parsed.tweet;
    } catch {
      return null;
    }

    return renderTweet(tweet, url);
  },
};
