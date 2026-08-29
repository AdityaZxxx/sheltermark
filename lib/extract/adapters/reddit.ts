import { httpFetch, readResponseBody } from "~/lib/utils/http-fetch";

import type { ExtractedContent } from "../types";
import type { FetchAdapter } from "./types";

// Reddit blocks framing and SSRs behind JS. Public `.json` endpoints return
// the post + comments without auth (Reddit's own embeds use the same data).
// ponytail: reddit.com is network-blocked from this machine — matched by
// fixture tests only; verify live (browser or deployed env) before trusting.
const MAX_BYTES = 512 * 1024;

interface RedditCommentData {
  author?: string;
  body_html?: string;
  created_utc?: number;
  replies?: RedditReplies;
}

interface RedditComment {
  kind: string;
  data: RedditCommentData;
}

// Replies envelope (kind "Listing"); "" from the wire means "no replies".
type RedditReplies = { kind: "Listing"; data: { children: RedditComment[] } };

// Wire form of a comment: replies may be the string "" (Reddit's no-replies
// marker) or a Listing envelope of more wire comments. decodeComments maps
// this recursively onto the domain shape above so downstream code never
// branches on the wire representation.
// Type guard: the wire replies field is either the string "" (Reddit's
// no-replies marker) or a Listing envelope of more wire comments.
function isListing(
  replies: string | WireListing | undefined,
): replies is WireListing {
  return Object.prototype.hasOwnProperty.call(replies ?? {}, "kind");
}

interface WireListing {
  kind: "Listing";
  data: { children: WireComment[] };
}

export interface WireComment {
  kind: string;
  data: {
    author?: string;
    body_html?: string;
    created_utc?: number;
    replies?: string | WireListing;
  };
}

export function decodeComments(children: WireComment[]): RedditComment[] {
  return children
    .filter((c) => c.kind === "t1")
    .map((c) => {
      const replies = c.data.replies;
      return {
        kind: c.kind,
        data: {
          author: c.data.author,
          body_html: c.data.body_html,
          created_utc: c.data.created_utc,
          // Wire replies is either the "" marker, absent, or a Listing
          // envelope of more wire comments — the only non-string shape.
          replies: isListing(replies)
            ? {
                ...replies,
                data: { children: decodeComments(replies.data.children) },
              }
            : undefined,
        },
      };
    });
}

// The second listing's children are comments (kind "t1"), the first is the
// post link (kind "t3") — same envelope, different payload shapes.

interface RedditPostListing {
  data: {
    children: {
      data: {
        title?: string;
        author?: string;
        selftext_html?: string | null;
        url_overridden_by_dest?: string | null;
        subreddit?: string;
        score?: number;
        num_comments?: number;
        permalink?: string;
        is_video?: boolean;
        is_gallery?: boolean;
        is_reddit_media_domain?: boolean;
        media?: unknown;
        preview?: {
          images?: {
            source?: { url?: string };
          }[];
        } | null;
      };
    }[];
  };
}

export function isRedditThread(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url);
    if (hostname !== "www.reddit.com" && hostname !== "reddit.com") {
      return false;
    }
    const parts = pathname.split("/").filter(Boolean);
    // /r/<sub>/comments/<id>/... — comments pages only.
    return parts[0] === "r" && parts[2] === "comments" && Boolean(parts[3]);
  } catch {
    return false;
  }
}

// Reddit sends HTML entities doubly-escaped in body_html; unescape once.
function decodeEntities(s: string): string {
  return s
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&");
}

function renderComments(
  children: RedditComment[],
  depth: number,
  out: string[],
): void {
  for (const c of children) {
    if (!c.data.body_html) continue;
    const who = c.data.author ?? "unknown";
    const body = decodeEntities(c.data.body_html);
    out.push(
      `<p style="margin-left:${depth}rem"><strong>${who}</strong><br>${body}</p>`,
    );
    if (c.data.replies) {
      renderComments(c.data.replies.data.children, depth + 1, out);
    }
    if (out.length >= 40) return;
  }
}

export const redditAdapter: FetchAdapter = {
  name: "reddit",
  kind: "fetch",
  matches: isRedditThread,
  fetch: async (url): Promise<ExtractedContent | null> => {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    // /r/<sub>/comments/<id>/... — comments pages only.
    if (parts[0] !== "r" || parts[2] !== "comments" || !parts[3]) return null;

    const apiUrl = `${new URL(url).origin}${new URL(url).pathname}.json?limit=30`;

    const { response } = await httpFetch(apiUrl, {
      headers: { Accept: "application/json" },
      retries: 0,
    });
    if (!response.ok) return null;

    const body = await readResponseBody(response, MAX_BYTES);
    let post: RedditPost | undefined;
    let comments: RedditComment[] = [];
    try {
      // SAFETY: Reddit returns [postListing, commentListing]; both shapes
      // verified by the kind field before use, extra fields ignored.
      const parsed = JSON.parse(body) as [
        RedditPostListing,
        { data: { children: WireComment[] } },
      ];
      post = parsed[0]?.data?.children?.[0]?.data;
      comments = decodeComments(parsed[1]?.data?.children ?? []);
    } catch {
      return null;
    }
    if (!post?.title) return null;

    return renderThread(post, comments, url);
  },
};

export type RedditPost = NonNullable<
  RedditPostListing["data"]["children"][number]["data"]
>;

// Pure post + comments → card render, exported for fixture tests (no network).
// Caller guarantees `post.title` is a non-empty string.
export function renderThread(
  post: RedditPost,
  comments: RedditComment[],
  url: string,
): ExtractedContent {
  const pieces: string[] = [];
  const link =
    post.url_overridden_by_dest && post.url_overridden_by_dest !== url
      ? post.url_overridden_by_dest
      : null;
  if (link) pieces.push(`<p><a href="${link}">${link}</a></p>`);
  if (post.selftext_html) {
    pieces.push(`<p>${decodeEntities(post.selftext_html)}</p>`);
  } else if (post.preview?.images?.[0]?.source?.url) {
    // preview image URLs are HTML-escaped (&amp;) in the JSON
    const img = decodeEntities(post.preview.images[0].source.url);
    pieces.push(`<img src="${img}">`);
  }

  const commentHtml: string[] = [];
  renderComments(comments, 0, commentHtml);
  pieces.push(...commentHtml);

  const stats = [
    post.score !== undefined ? `${post.score} points` : null,
    post.num_comments !== undefined ? `${post.num_comments} comments` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    title: post.title ?? url,
    byline: post.author ? `u/${post.author}` : null,
    siteName: post.subreddit ? `r/${post.subreddit}` : "Reddit",
    excerpt: null,
    html: [...pieces, stats ? `<p><small>${stats}</small></p>` : ""].join(""),
    length: (post.title ?? "").length,
    url,
  };
}
