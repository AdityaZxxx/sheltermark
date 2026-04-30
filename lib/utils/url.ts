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
    let hostname = urlObj.hostname.toLowerCase();
    if (hostname.startsWith("www.")) {
      hostname = hostname.slice(4);
    }
    urlObj.hostname = hostname;
    TRACKING_PARAMS.forEach((param) => {
      urlObj.searchParams.delete(param);
    });
    urlObj.hash = "";
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
