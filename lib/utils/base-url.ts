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
