function ensureProtocol(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `https://${url}`;
}

// Canonical public site origin for crawler-facing absolute URLs only
// (metadataBase, og:image). Social scrapers must see the deployed host,
// not the requester's. For anything that sends the user back to their
// current host (auth/email redirects), use getRequestBaseUrl() instead.
export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return ensureProtocol(process.env.NEXT_PUBLIC_SITE_URL);
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}
