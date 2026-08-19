export const ALWAYS_ALIVE_DOMAINS = [
  "twitter.com",
  "x.com",
  "nitter.net",
  "youtube.com",
  "youtu.be",
  "instagram.com",
  "tiktok.com",
  "facebook.com",
  "fb.com",
  "arxiv.org",
] as const;

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function isAlwaysAliveDomain(url: string): boolean {
  const hostname = getHostname(url);
  if (!hostname) return false;
  return ALWAYS_ALIVE_DOMAINS.some(
    (d) => hostname === d || hostname.endsWith(`.${d}`),
  );
}
