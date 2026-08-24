import { headers } from "next/headers";

import { getBaseUrl } from "~/lib/utils/base-url";
import { safeRedirectPath } from "~/lib/utils/safe-redirect";

export function authCallbackUrl(
  baseUrl: string,
  next: string | null | undefined = "/dashboard",
): string {
  return `${baseUrl}/auth/callback?next=${encodeURIComponent(safeRedirectPath(next))}`;
}

// Source of truth for URLs that must return the user to the host they are
// actually on (OAuth redirectTo, email-verification links): session cookies
// are per-host, so a fixed env origin sends the callback — and therefore
// the cookies — to the wrong jar. Crawler-facing metadata uses getBaseUrl()
// instead; that one is a deployment constant by design.
export async function getRequestBaseUrl(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) {
    return getBaseUrl();
  }
  const proto =
    headerList.get("x-forwarded-proto") ??
    (/^(localhost|127\.0\.0\.1|\d+\.\d+\.\d+\.\d+)(:\d+)?$/.test(host)
      ? "http"
      : "https");
  return `${proto}://${host}`;
}
