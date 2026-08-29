// Pure URL parsing for provider embeds — no Node builtins, safe to import
// from client components (ADR-0007 strategy 1). Reused by the server-side
// metadata strategies.
export function extractYouTubeVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    if (
      urlObj.hostname === "youtu.be" ||
      urlObj.hostname.endsWith(".youtu.be")
    ) {
      return urlObj.pathname.slice(1).split("/")[0] || null;
    }
    if (urlObj.pathname === "/watch") return urlObj.searchParams.get("v");
    const embedMatch = urlObj.pathname.match(
      /^\/(embed|shorts|live|v)\/([a-zA-Z0-9_-]{11})/,
    );
    if (embedMatch) return embedMatch[2] ?? null;
    const vMatch = urlObj.pathname.match(/^\/([a-zA-Z0-9_-]{11})$/);
    return vMatch?.[1] ?? null;
  } catch {
    return null;
  }
}

export function youtubeEmbedSrc(url: string): string | null {
  const id = extractYouTubeVideoId(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
}

// Spotify: every content type uses the same /embed/<type>/<id> shape.
export function spotifyEmbedSrc(url: string): string | null {
  try {
    const { hostname, pathname } = new URL(url);
    if (hostname !== "open.spotify.com" && hostname !== "play.spotify.com")
      return null;
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const [type, id] = parts;
    if (!type || !id) return null;
    return `https://open.spotify.com/embed/${type}/${id}`;
  } catch {
    return null;
  }
}

// SoundCloud: the canonical player URL takes the track/page URL as a query
// param; any soundcloud.com path works (track, set, user profile).
export function soundcloudEmbedSrc(url: string): string | null {
  try {
    const { hostname } = new URL(url);
    if (hostname !== "soundcloud.com" && !hostname.endsWith(".soundcloud.com"))
      return null;
    return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}`;
  } catch {
    return null;
  }
}

// Vimeo: player.vimeo.com/video/<id> is the frameable embed endpoint for a
// watch URL. ponytail: verified unreachable from this network — the panel's
// existing load-timeout fallback covers a dead embed; confirm in a browser
// before trusting it on prod.
export function vimeoEmbedSrc(url: string): string | null {
  try {
    const { hostname, pathname } = new URL(url);
    if (hostname !== "vimeo.com" && hostname !== "player.vimeo.com") {
      if (hostname === "www.vimeo.com") {
        // fall through to pathname parse
      } else {
        return null;
      }
    }
    const id = pathname.split("/").filter(Boolean)[0];
    return /^\d+$/.test(id ?? "")
      ? `https://player.vimeo.com/video/${id}`
      : null;
  } catch {
    return null;
  }
}
