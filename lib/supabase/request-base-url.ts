import { headers } from "next/headers";

import { getBaseUrl } from "~/lib/utils/base-url";
import { safeRedirectPath } from "~/lib/utils/safe-redirect";

export function authCallbackUrl(
  baseUrl: string,
  next: string | null | undefined = "/dashboard",
): string {
  return `${baseUrl}/auth/callback?next=${encodeURIComponent(safeRedirectPath(next))}`;
}

// OAuth/email-verification redirects must return to the host the user is
// actually on (session cookies are per-host). NEXT_PUBLIC_SITE_URL is a
// single fixed origin, so logging in from any other host sends the callback
// — and therefore the session cookies — to the wrong cookie jar.
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
