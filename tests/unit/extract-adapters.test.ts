import { describe, expect, it } from "bun:test";

import { hackerNewsAdapter } from "~/lib/extract/adapters/hackernews";
import { findAdapter } from "~/lib/extract/adapters/index";
import {
  decodeComments,
  renderThread,
  type RedditPost,
  type WireComment,
} from "~/lib/extract/adapters/reddit";
import { renderTweet, type FxTweet } from "~/lib/extract/adapters/x";

// DOM-adapter fixtures are minimal synthetic HTML matching each site's SSR
// layout — enough to prove selector behavior without network access in CI.
// GitHub is served by the native proxy, not an adapter (ADR-0007).
// against the live API in the browser smoke test.

const HN_HTML = `
<html><body>
  <table class="fatitem">
    <tr class="athing"><td class="title"><span class="titleline"><a href="https://example.com/story">A great story</a></span></td></tr>
    <tr><td class="subtext"><a class="hnuser">alice</a> 5 hours ago</td></tr>
    <tr><td class="toptext">This is the self-post text</td></tr>
  </table>
  <table class="comment-tree">
    <tr class="athing comtr"><td class="ind" indent="0"><img src="s.gif" width="0"></td><td><span class="hnuser">bob</span></td><td><div class="commtext c00">First comment <b>bold</b></div></td></tr>
    <tr class="athing comtr"><td class="ind" indent="40"><img src="s.gif" width="40"></td><td><span class="hnuser">carol</span></td><td><div class="commtext c00">Nested reply</div></td></tr>
  </table>
</body></html>`;

describe("adapter registry", () => {
  it("does not route github.com pages (the native proxy owns GitHub)", () => {
    expect(findAdapter("https://github.com/basecamp/omarchy")).toBeNull();
    expect(
      findAdapter("https://github.com/basecamp/omarchy/issues"),
    ).toBeNull();
  });

  it("routes news.ycombinator.com to the HN adapter", () => {
    expect(findAdapter("https://news.ycombinator.com/item?id=1")?.name).toBe(
      "hackernews",
    );
  });

  it("returns null for unknown sites", () => {
    expect(findAdapter("https://example.com/post")).toBeNull();
  });

  it("routes X statuses to the x adapter", () => {
    expect(findAdapter("https://x.com/jack/status/20")?.name).toBe("x");
    expect(findAdapter("https://twitter.com/jack/status/20")?.name).toBe("x");
  });

  it("does not route X profiles to the x adapter", () => {
    expect(findAdapter("https://x.com/jack")).toBeNull();
  });

  it("routes Reddit threads to the reddit adapter", () => {
    expect(
      findAdapter("https://www.reddit.com/r/programming/comments/1a/post/")
        ?.name,
    ).toBe("reddit");
  });

  it("does not route Reddit subreddit pages to the reddit adapter", () => {
    expect(findAdapter("https://www.reddit.com/r/programming")).toBeNull();
  });
});

describe("hackernews adapter", () => {
  it("extracts title, author, self-text and comments with nesting", () => {
    const out = hackerNewsAdapter.adapt(
      HN_HTML,
      "https://news.ycombinator.com/item?id=1",
    );
    expect(out).not.toBeNull();
    expect(out?.title).toBe("A great story");
    expect(out?.byline).toBe("alice");
    expect(out?.html).toContain("This is the self-post text");
    expect(out?.html).toContain("<strong>bob</strong>");
    expect(out?.html).toContain("Nested reply");
    expect(out?.html).toContain("margin-left:1rem");
    expect(out?.html).toContain("https://example.com/story");
  });

  it("returns null when there is no title row (non-item pages)", () => {
    expect(
      hackerNewsAdapter.adapt(
        "<html><body><table></table></body></html>",
        "https://news.ycombinator.com/",
      ),
    ).toBeNull();
  });
});

describe("x adapter (fxtwitter card render)", () => {
  const TWEET: FxTweet = {
    text: "just setting up my twttr",
    url: "https://x.com/jack/status/20",
    created_at: "Tue Mar 21 20:50:14 +0000 2006",
    likes: 310785,
    replies: 18003,
    retweets: 124742,
    views: null,
    author: {
      name: "jack",
      screen_name: "jack",
      avatar_url: "https://example.com/avatar.jpg",
    },
    media: {
      photos: [
        {
          url: "https://example.com/pic.jpg",
          width: 1,
          height: 1,
          alt: "a pic",
        },
      ],
    },
  };

  it("renders text, photos, and stats into a card", () => {
    const out = renderTweet(TWEET, TWEET.url);
    expect(out.title).toBe("Post by jack");
    expect(out.byline).toBe("jack (@jack)");
    expect(out.html).toContain("just setting up my twttr");
    expect(out.html).toContain('<img src="https://example.com/pic.jpg"');
    expect(out.html).toContain("310,785 likes");
    expect(out.html).not.toContain("views");
  });

  it("renders without media or author", () => {
    const out = renderTweet(
      { ...TWEET, media: null, author: null, likes: null },
      TWEET.url,
    );
    expect(out.title).toBe("X post");
    expect(out.byline).toBeNull();
    expect(out.html).not.toContain("<img");
    expect(out.html).not.toContain("likes");
  });
});

describe("reddit adapter (wire decode + thread render)", () => {
  const WIRE: WireComment[] = [
    {
      kind: "t1",
      data: {
        author: "alice",
        body_html: "&lt;p&gt;First!&lt;/p&gt;",
        replies: {
          kind: "Listing",
          data: {
            children: [
              {
                kind: "t1",
                data: {
                  author: "bob",
                  body_html: "nested reply",
                  replies: "",
                },
              },
            ] satisfies WireComment[],
          },
        },
      },
    },
    {
      kind: "t3",
      data: { author: "spammer", body_html: "should be filtered" },
    },
  ];

  const POST: RedditPost = {
    title: "Some cool link",
    author: "alice",
    selftext_html: null,
    url_overridden_by_dest: "https://example.com/article",
    subreddit: "programming",
    score: 42,
    num_comments: 1,
    permalink: "/r/programming/comments/1a/post/",
    is_video: false,
    is_gallery: false,
    is_reddit_media_domain: false,
    media: null,
    preview: { images: [{ source: { url: "https://example.com/img.jpg" } }] },
  };

  it("decodes comments, drops non-t1 kinds and no-reply markers", () => {
    const out = decodeComments(WIRE);
    expect(out).toHaveLength(1);
    expect(out[0]?.data.author).toBe("alice");
    expect(out[0]?.data.replies?.data.children).toHaveLength(1);
    expect(
      out[0]?.data.replies?.data.children[0]?.data.replies,
    ).toBeUndefined();
  });

  it("renders link, preview image, nested comments and stats", () => {
    const comments = decodeComments(WIRE);
    const out = renderThread(
      POST,
      comments,
      "https://www.reddit.com/r/programming/comments/1a/post/",
    );
    expect(out.title).toBe("Some cool link");
    expect(out.byline).toBe("u/alice");
    expect(out.siteName).toBe("r/programming");
    expect(out.html).toContain("https://example.com/article");
    expect(out.html).toContain("<p>First!</p>");
    expect(out.html).toContain("nested reply");
    expect(out.html).toContain("42 points");
    expect(out.html).toContain("margin-left:1rem");
    expect(out.html).not.toContain("spammer");
  });
});
