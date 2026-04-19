import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const PASTEL_COLORS = [
  "#fca5a5",
  "#fdba74",
  "#fcd34d",
  "#fde047",
  "#bef264",
  "#86efac",
  "#6ee7b7",
  "#5eead4",
  "#67e8f9",
  "#7dd3fc",
  "#93c5fd",
  "#a5b4fc",
  "#c4b5fd",
  "#d8b4fe",
  "#f0abfc",
  "#f9a8d4",
  "#fda4af",
];

export function getPastelColor(id: string) {
  if (id === "default" || !id) return "bg-muted";
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PASTEL_COLORS.length;
  return PASTEL_COLORS[index];
}

export function safeDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url || "";
  }
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function ensureProtocol(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `https://${url}`;
}

export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return ensureProtocol(process.env.NEXT_PUBLIC_SITE_URL);
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

export function getBrokenLinkMessage(
  status: number | null | undefined,
): string {
  if (!status) return "Link unreachable";
  if (status === 0) return "Connection timeout";
  if (status === 403) return "Access denied by server";
  if (status === 404) return "Page not found";
  if (status === 410) return "Page permanently deleted";
  if (status >= 500) return "Server error";
  if (status >= 400) return `Error (${status})`;
  return "Link issue";
}

const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "ttclid",
  "irclid",
  "mc_cid",
  "mc_eid",
  "s_kwcid",
  "_ga",
  "_gl",
  "yclid",
  "wickedid",
  "wbraid",
  "gbraid",
];

export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);

    // Normalize hostname: lowercase + remove www prefix
    let hostname = urlObj.hostname.toLowerCase();
    if (hostname.startsWith("www.")) {
      hostname = hostname.slice(4);
    }
    urlObj.hostname = hostname;

    // Remove tracking params
    TRACKING_PARAMS.forEach((param) => {
      urlObj.searchParams.delete(param);
    });

    // Remove hash
    urlObj.hash = "";

    // Remove trailing slash (except for root path)
    let pathname = urlObj.pathname;
    if (pathname.length > 1 && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }
    urlObj.pathname = pathname;

    return urlObj.toString();
  } catch {
    return url;
  }
}
