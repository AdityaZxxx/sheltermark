import type { Bookmark } from "~/lib/schemas/bookmark.schema";

import { isHackerNewsItem } from "~/lib/extract/adapters/hackernews";
import { isRedditThread } from "~/lib/extract/adapters/reddit";
import { isXStatus } from "~/lib/extract/adapters/x";
import {
  soundcloudEmbedSrc,
  spotifyEmbedSrc,
  vimeoEmbedSrc,
  youtubeEmbedSrc,
} from "~/lib/preview/embeds";

// Preview resolution (ADR-0007). The resolver maps a bookmark to one render
// instruction for the kind-agnostic preview panel. Ordering: provider embed →
// native proxy (GitHub) → platform strategy; unresolved URLs fall back to
// direct-iframe, where the panel probes embeddability and downgrades to
// server extraction when the origin refuses framing. A framing failure is
// handled by the panel's timeout/blocked state, not a distinct kind.
export type PreviewKind =
  | { kind: "embed"; src: string }
  | { kind: "iframe"; src: string }
  | { kind: "proxy"; src: string }
  | { kind: "server"; src: string };

interface PreviewResolver {
  resolve: (bookmark: Bookmark) => PreviewKind | null;
}

// Strategy 1: provider embeds — pure client-side URL transformation into the
// provider's officially frameable embed endpoint. No server fetch; the embed
// host is a hard-coded provider origin, not user input.

function isYouTubeHost(hostname: string): boolean {
  return (
    hostname === "youtube.com" ||
    hostname.endsWith(".youtube.com") ||
    hostname === "youtube-nocookie.com" ||
    hostname.endsWith(".youtube-nocookie.com") ||
    hostname === "youtu.be"
  );
}

// Each provider: hostname(s) it owns and a pure URL → embed-src transform.
// A null src (unrecognized path shape) declines, falling through the chain.
const PROVIDERS: {
  hosts: string[];
  embedSrc: (url: string) => string | null;
}[] = [
  {
    hosts: ["open.spotify.com", "play.spotify.com"],
    embedSrc: spotifyEmbedSrc,
  },
  { hosts: ["soundcloud.com"], embedSrc: soundcloudEmbedSrc },
  {
    hosts: ["vimeo.com", "player.vimeo.com", "www.vimeo.com"],
    embedSrc: vimeoEmbedSrc,
  },
];

const providerEmbed: PreviewResolver = {
  resolve: (bookmark) => {
    try {
      const { hostname } = new URL(bookmark.url);

      if (isYouTubeHost(hostname)) {
        const src = youtubeEmbedSrc(bookmark.url);
        if (src) return { kind: "embed", src };
      }

      for (const provider of PROVIDERS) {
        if (!provider.hosts.includes(hostname)) continue;
        const src = provider.embedSrc(bookmark.url);
        if (src) return { kind: "embed", src };
      }
    } catch {
      // fall through
    }
    return null;
  },
};

// Strategy 2.5: native proxy — GitHub-only full-page re-serve (ADR-0007).
// Runs before platform strategies because the proxy renders the real page
// rather than an extracted card. Any github.com/gist.github.com URL renders
// natively; the document transform is page-agnostic.

const nativeProxy: PreviewResolver = {
  resolve: (bookmark) => {
    try {
      const { protocol, hostname } = new URL(bookmark.url);
      // https-only, matching isGithubUrl in the proxy route; an http URL
      // would resolve here but 403 at the route, so let it fall through
      // to the iframe/extraction chain instead.
      if (
        protocol === "https:" &&
        (hostname === "github.com" || hostname === "gist.github.com")
      ) {
        return {
          kind: "proxy",
          src: `/api/preview/web?url=${encodeURIComponent(bookmark.url)}`,
        };
      }
    } catch {
      // fall through
    }
    return null;
  },
};

// Strategy 3: platform strategies — framing-hostile sites with structured
// data sources. Matched by hostname before any embeddability probe; the
// server route picks the adapter internally. Predicates are the adapters'
// own exported `matches` logic — one definition of "an HN item / X status /
// Reddit thread" per platform, shared by resolver and route.

const platformStrategy: PreviewResolver = {
  resolve: (bookmark) => {
    if (
      isHackerNewsItem(bookmark.url) ||
      isXStatus(bookmark.url) ||
      isRedditThread(bookmark.url)
    ) {
      return {
        kind: "server",
        src: `/api/preview?url=${encodeURIComponent(bookmark.url)}`,
      };
    }
    return null;
  },
};

// Ordered registry: cheapest/most-native first; first resolution wins.
// Synchronous hostname-based strategies — the direct-iframe/extraction split
// needs the server embeddability probe (checkEmbeddable), so it happens in
// the panel after these cheap resolvers decline.
const RESOLVERS: PreviewResolver[] = [
  providerEmbed,
  nativeProxy,
  platformStrategy,
];

export function resolvePreview(bookmark: Bookmark): PreviewKind {
  for (const resolver of RESOLVERS) {
    const result = resolver.resolve(bookmark);
    if (result) return result;
  }
  // Unresolved URLs are not dead ends: the panel runs checkEmbeddable and
  // either frames the original or routes to /api/preview extraction.
  return { kind: "iframe", src: bookmark.url };
}
