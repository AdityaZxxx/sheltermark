const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&#x27;": "'",
  "&#x2F;": "/",
  "&nbsp;": " ",
  "&mdash;": "—",
  "&ndash;": "–",
  "&hellip;": "…",
  "&copy;": "©",
  "&reg;": "®",
  "&trade;": "™",
};

export function decodeHtmlEntities(text: string): string {
  let decoded = text;
  for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
    decoded = decoded.split(entity).join(char);
  }
  decoded = decoded.replace(/&#(\d+);/g, (_, code) =>
    String.fromCharCode(Number.parseInt(code, 10)),
  );
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_, code) =>
    String.fromCharCode(Number.parseInt(code, 16)),
  );
  return decoded;
}

export function resolveUrl(
  path: string | null,
  baseUrl: string,
): string | null {
  if (!path) return null;
  try {
    return new URL(path, baseUrl).toString();
  } catch {
    return null;
  }
}

export function getGoogleFavicon(hostname: string): string {
  return `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 5000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

export function isPrivateIP(ip: string): boolean {
  const ipv4Match = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4Match) {
    const [, p1, p2] = ipv4Match.map(Number);
    if (p1 === 10) return true;
    if (p1 === 127) return true;
    if (p1 === 169 && p2 === 254) return true;
    if (p1 === 172 && p2 >= 16 && p2 <= 31) return true;
    if (p1 === 192 && p2 === 168) return true;
    if (p1 >= 240) return true;
  }

  const ipLower = ip.toLowerCase();
  if (
    ipLower === "::1" ||
    ipLower === "::" ||
    ipLower.startsWith("fe80:") ||
    ipLower.startsWith("fc00:") ||
    ipLower.startsWith("fd00:") ||
    ipLower.startsWith("ff00:")
  ) {
    return true;
  }

  return false;
}

export function createBasicMetadata(
  url: string,
  hostname: string,
): import("./types").Metadata {
  return {
    title: url,
    og_image_url: null,
    favicon_url: getGoogleFavicon(hostname),
  };
}
