import { describe, expect, it } from "bun:test";

import type { Bookmark } from "~/lib/schemas/bookmark.schema";

import { resolvePreview, effectivePreview } from "~/lib/preview/resolve";

function bookmarkFor(url: string): Bookmark {
  const fixture = {
    id: "00000000-0000-0000-0000-000000000000",
    user_id: "u",
    workspace_id: null,
    url,
    title: null,
    description: null,
    note: null,
    favicon_url: null,
    og_image_url: null,
    broken_status: null,
    broken_checked_at: null,
    is_public: false,
    deleted_at: null,
    is_broken: false,
    last_checked_at: null,
    http_status: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    tags: [],
  };
  // SAFETY: test fixture — resolvePreview only reads `url`; every other
  // Bookmark field is provided or a harmless null.
  return fixture as Bookmark;
}

describe("resolvePreview", () => {
  describe("strategy 1: provider embed (YouTube)", () => {
    it("resolves watch URLs to the nocookie embed", () => {
      const out = resolvePreview(
        bookmarkFor("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
      );
      expect(out).toEqual({
        kind: "embed",
        src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      });
    });

    it("resolves youtu.be short links", () => {
      const out = resolvePreview(bookmarkFor("https://youtu.be/dQw4w9WgXcQ"));
      expect(out).toEqual({
        kind: "embed",
        src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      });
    });

    it("resolves shorts URLs", () => {
      const out = resolvePreview(
        bookmarkFor("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
      );
      expect(out).toEqual({
        kind: "embed",
        src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      });
    });

    it("declines non-video YouTube pages (falls through to iframe)", () => {
      const out = resolvePreview(bookmarkFor("https://www.youtube.com/"));
      expect(out.kind).toBe("iframe");
    });
  });

  describe("strategy 1: provider embed (Spotify)", () => {
    it("resolves track URLs to the embed player", () => {
      const out = resolvePreview(
        bookmarkFor(
          "https://open.spotify.com/track/4cOdK2wLKTKyjIkZ5y0SHM?si=abc",
        ),
      );
      expect(out).toEqual({
        kind: "embed",
        src: "https://open.spotify.com/embed/track/4cOdK2wLKTKyjIkZ5y0SHM",
      });
    });

    it("resolves playlists and albums", () => {
      const playlist = resolvePreview(
        bookmarkFor("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"),
      );
      expect(playlist).toEqual({
        kind: "embed",
        src: "https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M",
      });
      const album = resolvePreview(
        bookmarkFor("https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3"),
      );
      expect(album).toEqual({
        kind: "embed",
        src: "https://open.spotify.com/embed/album/1DFixLWuPkv3KT3TnV35m3",
      });
    });

    it("declines bare Spotify pages", () => {
      expect(
        resolvePreview(bookmarkFor("https://open.spotify.com/")).kind,
      ).toBe("iframe");
    });
  });

  describe("strategy 1: provider embed (SoundCloud)", () => {
    it("resolves track URLs to the player with encoded source", () => {
      const out = resolvePreview(
        bookmarkFor("https://soundcloud.com/forss/flickermood"),
      );
      expect(out).toEqual({
        kind: "embed",
        src: "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fforss%2Fflickermood",
      });
    });

    it("declines non-soundcloud hosts", () => {
      expect(
        resolvePreview(bookmarkFor("https://example.com/track/1")).kind,
      ).toBe("iframe");
    });
  });

  describe("strategy 1: provider embed (Vimeo)", () => {
    it("resolves watch URLs to the player", () => {
      const out = resolvePreview(bookmarkFor("https://vimeo.com/76979871"));
      expect(out).toEqual({
        kind: "embed",
        src: "https://player.vimeo.com/video/76979871",
      });
    });

    it("declines non-numeric paths", () => {
      expect(resolvePreview(bookmarkFor("https://vimeo.com/about")).kind).toBe(
        "iframe",
      );
    });
  });

  describe("strategy 2.5: native proxy (GitHub)", () => {
    it("resolves GitHub repos to the native proxy", () => {
      const out = resolvePreview(
        bookmarkFor("https://github.com/basecamp/omarchy"),
      );
      expect(out).toEqual({
        kind: "proxy",
        src: `/api/preview/web?url=${encodeURIComponent("https://github.com/basecamp/omarchy")}`,
      });
    });

    it("resolves GitHub issues/PRs and gists to the native proxy", () => {
      expect(
        resolvePreview(
          bookmarkFor("https://github.com/basecamp/omarchy/issues"),
        ).kind,
      ).toBe("proxy");
      expect(
        resolvePreview(bookmarkFor("https://gist.github.com/user/abc")).kind,
      ).toBe("proxy");
    });

    it("does not proxy look-alike hosts", () => {
      expect(
        resolvePreview(bookmarkFor("https://github.com.evil.com/a/b")).kind,
      ).not.toBe("proxy");
      expect(resolvePreview(bookmarkFor("https://evil.com/a/b")).kind).toBe(
        "iframe",
      );
    });

    it("declines http GitHub URLs (falls through, no route 403)", () => {
      expect(resolvePreview(bookmarkFor("http://github.com/a/b")).kind).toBe(
        "iframe",
      );
    });
  });

  describe("strategy 3: platform strategies", () => {
    it("resolves HN items to the server preview", () => {
      const out = resolvePreview(
        bookmarkFor("https://news.ycombinator.com/item?id=1"),
      );
      expect(out.kind).toBe("server");
      if (out.kind === "server") {
        expect(out.src).toBe(
          `/api/preview?url=${encodeURIComponent("https://news.ycombinator.com/item?id=1")}`,
        );
      }
    });

    it("resolves X statuses to the server preview", () => {
      const out = resolvePreview(bookmarkFor("https://x.com/jack/status/20"));
      expect(out.kind).toBe("server");
    });

    it("resolves twitter.com statuses too", () => {
      const out = resolvePreview(
        bookmarkFor("https://twitter.com/jack/status/20"),
      );
      expect(out.kind).toBe("server");
    });

    it("declines X profile pages", () => {
      expect(resolvePreview(bookmarkFor("https://x.com/jack")).kind).toBe(
        "iframe",
      );
    });

    it("resolves Reddit threads to the server preview", () => {
      const out = resolvePreview(
        bookmarkFor(
          "https://www.reddit.com/r/programming/comments/1abcde/some_thread/",
        ),
      );
      expect(out.kind).toBe("server");
    });

    it("declines Reddit non-thread pages", () => {
      expect(
        resolvePreview(bookmarkFor("https://www.reddit.com/r/programming"))
          .kind,
      ).toBe("iframe");
    });

    it("declines the HN front page (items only — the adapter models /item)", () => {
      expect(
        resolvePreview(bookmarkFor("https://news.ycombinator.com/")).kind,
      ).toBe("iframe");
      expect(
        resolvePreview(bookmarkFor("https://news.ycombinator.com/news")).kind,
      ).toBe("iframe");
    });
  });

  describe("strategy 2: direct iframe default", () => {
    it("resolves unknown URLs to a direct iframe of the original", () => {
      const out = resolvePreview(bookmarkFor("https://example.com/post"));
      expect(out).toEqual({ kind: "iframe", src: "https://example.com/post" });
    });
  });

  describe("effectivePreview: media classification (phase 3)", () => {
    it("routes .pdf URLs to the media proxy kind", () => {
      const out = effectivePreview(
        bookmarkFor("https://example.com/paper.pdf"),
        null,
      );
      expect(out).toEqual({
        kind: "pdf",
        src: `/api/preview/media?url=${encodeURIComponent("https://example.com/paper.pdf")}`,
      });
    });

    it("routes arXiv /pdf/<id> URLs to the PDF viewer", () => {
      const out = effectivePreview(
        bookmarkFor("https://arxiv.org/pdf/2401.12345"),
        null,
      );
      expect(out.kind).toBe("pdf");
    });

    it("prefers the probe's Content-Type over the URL guess", () => {
      // URL says .pdf but the origin actually serves HTML (common for
      // rewritten CMS routes): the header is authoritative, so the PDF
      // viewer is skipped. The embeddable:false downgrade to extraction is
      // the panel's job (same as any HTML iframe refusal).
      const out = effectivePreview(
        bookmarkFor("https://example.com/paper.pdf"),
        { embeddable: false, contentType: "text/html" },
      );
      expect(out.kind).toBe("iframe");
    });

    it("uses Content-Type when the URL has no extension", () => {
      const out = effectivePreview(bookmarkFor("https://example.com/get/42"), {
        embeddable: true,
        contentType: "application/pdf",
      });
      expect(out.kind).toBe("pdf");
    });

    it("keeps the iframe for embeddable HTML documents", () => {
      const out = effectivePreview(bookmarkFor("https://example.com/post"), {
        embeddable: true,
        contentType: "text/html; charset=utf-8",
      });
      expect(out).toEqual({ kind: "iframe", src: "https://example.com/post" });
    });

    it("still routes media when the origin also refuses framing", () => {
      // A PDF behind XFO DENY: embeddability is moot for non-HTML content —
      // the viewer must win over the extraction downgrade.
      const out = effectivePreview(bookmarkFor("https://example.com/a.pdf"), {
        embeddable: false,
        contentType: "application/pdf",
      });
      expect(out.kind).toBe("pdf");
    });

    it("routes images, video, and audio to the proxy route", () => {
      const img = effectivePreview(
        bookmarkFor("https://example.com/pic.png"),
        null,
      );
      expect(img.kind).toBe("image");
      const vid = effectivePreview(bookmarkFor("https://example.com/v/9"), {
        embeddable: true,
        contentType: "video/mp4",
      });
      expect(vid.kind).toBe("video");
      const aud = effectivePreview(bookmarkFor("https://example.com/a/1"), {
        embeddable: true,
        contentType: "audio/ogg",
      });
      expect(aud.kind).toBe("audio");
      expect(img.src).toContain("/api/preview/media?url=");
    });

    it("never overrides domain strategies (embed/proxy/server win)", () => {
      const yt = effectivePreview(bookmarkFor("https://youtu.be/x"), {
        embeddable: true,
        contentType: "text/html",
      });
      expect(yt.kind).toBe("embed");
      const gh = effectivePreview(bookmarkFor("https://github.com/a/b"), null);
      expect(gh.kind).toBe("proxy");
      const hn = effectivePreview(
        bookmarkFor("https://news.ycombinator.com/item?id=1"),
        { embeddable: false, contentType: "text/html" },
      );
      expect(hn.kind).toBe("server");
    });
  });
});
