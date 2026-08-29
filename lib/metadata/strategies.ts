import { isAlwaysAliveDomain } from "~/lib/link-health/domains";
import { extractYouTubeVideoId } from "~/lib/preview/embeds";
import { httpFetch, readResponseBody } from "~/lib/utils/http-fetch";

import type { Metadata } from "./types";

import { extractMetadataFromHtml } from "./extract";
import { isSafeUrl, MAX_HTML_SIZE } from "./fetch";
import { decodeHtmlEntities, getGoogleFavicon } from "./utils";

type Platform = "twitter" | "youtube" | "js-heavy" | "arxiv" | "generic";

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const hostnameMatches = (h: string, domain: string) =>
  h === domain || h.endsWith(`.${domain}`);

function detectPlatform(hostname: string): Platform {
  if (!isAlwaysAliveDomain(`https://${hostname}`)) return "generic";
  if (hostnameMatches(hostname, "arxiv.org")) return "arxiv";
  if (
    hostnameMatches(hostname, "twitter.com") ||
    hostnameMatches(hostname, "x.com")
  )
    return "twitter";
  if (
    hostnameMatches(hostname, "youtube.com") ||
    hostnameMatches(hostname, "youtu.be") ||
    hostnameMatches(hostname, "youtube-nocookie.com")
  )
    return "youtube";
  if (
    hostnameMatches(hostname, "instagram.com") ||
    hostnameMatches(hostname, "facebook.com")
  )
    return "js-heavy";
  return "generic";
}

function extractXArticleId(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const match =
      pathname.match(/\/(?:i\/)?article\/(\d+)/) ??
      pathname.match(/\/i\/status\/(\d+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

async function fetchXArticleHtml(url: string): Promise<Metadata | null> {
  const { response, finalUrl } = await httpFetch(url, {
    userAgent: BROWSER_USER_AGENT,
    followRedirect: { maxHops: 5 },
    onRedirectHop: isSafeUrl,
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  if (!response.ok) return null;
  const html = await readResponseBody(response, MAX_HTML_SIZE);
  const extracted = extractMetadataFromHtml(html, finalUrl);
  if (
    extracted.title === new URL(finalUrl).hostname &&
    !extracted.og_image_url
  ) {
    return null;
  }
  return extracted;
}

async function fetchTwitter(url: string): Promise<Metadata | null> {
  const pathname = new URL(url).pathname;
  const articleId = extractXArticleId(url);
  const apiPath =
    articleId && !pathname.startsWith("/i/status/")
      ? `/i/status/${articleId}`
      : pathname;

  const { response: res } = await httpFetch(
    `https://api.fxtwitter.com${apiPath}`,
  );
  if (!res.ok) {
    if (articleId) return fetchXArticleHtml(url);
    return null;
  }
  const data = await res.json();
  if (data.tweet) {
    const article = data.tweet.article;
    if (article) {
      const authorName = data.tweet.author?.name || "User";
      const coverUrl = article.cover_media?.media_info?.original_img_url;
      return {
        title:
          decodeHtmlEntities((article.title || "").trim()) ||
          `${authorName} on X`,
        description: article.preview_text || null,
        og_image_url: coverUrl || data.tweet.author?.avatar_url || null,
        favicon_url: data.tweet.author?.avatar_url || null,
      };
    }
    return {
      title: `${data.tweet.author?.name || "User"} on X: "${data.tweet.text?.substring(0, 50) || ""}..."`,
      description: null,
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
      description: null,
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
      const { response: res } = await httpFetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
        { headers: { Accept: "application/json" } },
      );
      if (!res.ok) return null;
      const data = await res.json();
      return {
        title: decodeHtmlEntities(data.title || url),
        description: null,
        og_image_url: data.thumbnail_url,
        favicon_url: fallbackFavicon,
      };
    },
    async () => {
      const { response: res } = await httpFetch(
        `https://noembed.com/embed?url=${encodeURIComponent(url)}`,
        { headers: { Accept: "application/json" } },
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data.error
        ? null
        : {
            title: decodeHtmlEntities(data.title || url),
            description: null,
            og_image_url: data.thumbnail_url,
            favicon_url: null,
          };
    },
  ]) {
    const result = await fetcher();
    if (result) {
      return {
        title: result.title,
        description: null,
        og_image_url: result.og_image_url || fallbackThumb,
        favicon_url: result.favicon_url || fallbackFavicon,
      };
    }
  }

  if (videoId)
    return {
      title: "YouTube Video",
      description: null,
      og_image_url: fallbackThumb,
      favicon_url: fallbackFavicon,
    };
  return null;
}

async function fetchJsHeavy(url: string): Promise<Metadata | null> {
  const { response: res } = await httpFetch(
    `https://api.microlink.io?url=${encodeURIComponent(url)}`,
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.status || data.status !== "success") return null;
  return {
    title: decodeHtmlEntities(data.data?.title || url),
    description: null,
    og_image_url: data.data?.image?.url || null,
    favicon_url: data.data?.logo?.url || null,
  };
}

async function fetchArxiv(url: string): Promise<Metadata | null> {
  const id = extractArxivId(url);
  if (!id) return null;

  const absUrl = `https://arxiv.org/abs/${id}`;
  const { response } = await httpFetch(absUrl, {
    headers: { Accept: "text/html,application/xhtml+xml" },
  });
  if (!response.ok) return null;

  const html = await readResponseBody(response, MAX_HTML_SIZE);
  const extracted = extractMetadataFromHtml(html, absUrl);
  return {
    title: extracted.title,
    description: extracted.description,
    og_image_url: null,
    favicon_url: extracted.favicon_url ?? getGoogleFavicon("arxiv.org"),
  };
}

function extractArxivId(url: string): string | null {
  try {
    const match = new URL(url).pathname.match(/\/(?:abs|pdf)\/([^/?#]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function fallbackStrategy(
  url: string,
  hostname: string,
): Promise<Metadata | null> {
  const platform = detectPlatform(hostname);
  if (platform === "arxiv") return fetchArxiv(url);
  if (platform === "twitter") return fetchTwitter(url);
  if (platform === "youtube") return fetchYouTube(url);
  if (platform === "js-heavy") return fetchJsHeavy(url);
  return null;
}

export const fetchViaMicrolink = fetchJsHeavy;
