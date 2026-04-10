import type { Metadata } from "./types";
import {
  decodeHtmlEntities,
  fetchWithTimeout,
  getGoogleFavicon,
} from "./utils";

type Platform = "twitter" | "youtube" | "js-heavy" | "generic";

const PLATFORMS: Record<Platform, (hostname: string) => boolean> = {
  twitter: (h) =>
    h === "twitter.com" ||
    h.endsWith(".twitter.com") ||
    h === "x.com" ||
    h.endsWith(".x.com"),
  youtube: (h) =>
    h === "youtube.com" ||
    h.endsWith(".youtube.com") ||
    h === "youtu.be" ||
    h.endsWith(".youtu.be") ||
    h === "youtube-nocookie.com" ||
    h.endsWith(".youtube-nocookie.com"),
  "js-heavy": (h) =>
    h === "instagram.com" ||
    h.endsWith(".instagram.com") ||
    h === "facebook.com" ||
    h.endsWith(".facebook.com"),
  generic: () => true,
};

function detectPlatform(hostname: string): Platform {
  for (const [platform, check] of Object.entries(PLATFORMS)) {
    if (check(hostname)) return platform as Platform;
  }
  return "generic";
}

function extractYouTubeVideoId(url: string): string | null {
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
    if (embedMatch) return embedMatch[2];
    const vMatch = urlObj.pathname.match(/^\/([a-zA-Z0-9_-]{11})$/);
    return vMatch?.[1] ?? null;
  } catch {
    return null;
  }
}

async function fetchTwitter(url: string): Promise<Metadata | null> {
  const apiUrl = `https://api.fxtwitter.com${new URL(url).pathname}`;
  const res = await fetchWithTimeout(apiUrl, {
    headers: { "User-Agent": "Sheltermark/1.0" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.tweet) {
    return {
      title: `${data.tweet.author?.name || "User"} on X: "${data.tweet.text?.substring(0, 50) || ""}..."`,
      og_image_url:
        data.tweet.media?.photos?.[0]?.url ||
        data.tweet.author?.avatar_url ||
        null,
      favicon_url: data.tweet.author?.avatar_url || null,
    };
  }
  if (data.user) {
    return {
      title: `${data.user.name || "User"} (@${data.user.screen_name || "unknown"}) / X`,
      og_image_url: data.user.avatar_url?.replace("_normal", "") || null,
      favicon_url: data.user.avatar_url || null,
    };
  }
  return null;
}

async function fetchYouTube(url: string): Promise<Metadata | null> {
  const videoId = extractYouTubeVideoId(url);
  const fallbackThumb = videoId
    ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    : null;
  const fallbackFavicon = getGoogleFavicon("youtube.com");

  for (const fetcher of [
    async () => {
      const res = await fetchWithTimeout(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
        { headers: { Accept: "application/json" } },
      );
      if (!res.ok) return null;
      const data = await res.json();
      return {
        title: decodeHtmlEntities(data.title || url),
        og_image_url: data.thumbnail_url,
        favicon_url: fallbackFavicon,
      };
    },
    async () => {
      const res = await fetchWithTimeout(
        `https://noembed.com/embed?url=${encodeURIComponent(url)}`,
        { headers: { Accept: "application/json" } },
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data.error
        ? null
        : {
            title: decodeHtmlEntities(data.title || url),
            og_image_url: data.thumbnail_url,
            favicon_url: null,
          };
    },
  ]) {
    const result = await fetcher();
    if (result) {
      return {
        title: result.title,
        og_image_url: result.og_image_url || fallbackThumb,
        favicon_url: result.favicon_url || fallbackFavicon,
      };
    }
  }

  if (videoId)
    return {
      title: "YouTube Video",
      og_image_url: fallbackThumb,
      favicon_url: fallbackFavicon,
    };
  return null;
}

async function fetchJsHeavy(url: string): Promise<Metadata | null> {
  const res = await fetchWithTimeout(
    `https://api.microlink.io?url=${encodeURIComponent(url)}`,
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.status || data.status !== "success") return null;
  return {
    title: decodeHtmlEntities(data.data?.title || url),
    og_image_url: data.data?.image?.url || null,
    favicon_url: data.data?.logo?.url || null,
  };
}

export async function fallbackStrategy(
  url: string,
  hostname: string,
): Promise<Metadata | null> {
  const platform = detectPlatform(hostname);
  if (platform === "twitter") return fetchTwitter(url);
  if (platform === "youtube") return fetchYouTube(url);
  if (platform === "js-heavy") return fetchJsHeavy(url);
  return null;
}

export const fetchViaMicrolink = fetchJsHeavy;
export const isTwitterUrl = PLATFORMS.twitter;
export const isYouTubeUrl = PLATFORMS.youtube;
export const isJsHeavySite = PLATFORMS["js-heavy"];
