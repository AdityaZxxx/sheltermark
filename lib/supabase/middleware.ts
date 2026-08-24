import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const PROTECTED_PATHS = ["/dashboard", "/workspace", "/reset-password"];
const AUTH_ONLY_PATHS = ["/login", "/signup", "/forgot-password"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase environment variables. Please check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, {
            ...options,
            // Required by the browser extension: its content scripts fetch
            // this app cross-site (they run on x.com, not on this origin),
            // and browsers only attach cookies to cross-site requests when
            // they are SameSite=None. Removing this silently breaks every
            // extension save/sync path.
            sameSite: "none",
            secure: process.env.NODE_ENV === "production",
          });
        });
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const isProtectedPath = PROTECTED_PATHS.some((path) =>
    pathname.startsWith(path),
  );

  const isAuthOnlyPath =
    AUTH_ONLY_PATHS.some((path) => pathname.startsWith(path)) ||
    pathname === "/";

  if (error && isProtectedPath) {
    const redirectUrl = new URL("/login", request.url);
    const returnTo = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    redirectUrl.searchParams.set("next", returnTo);
    return NextResponse.redirect(redirectUrl);
  }

  if (isProtectedPath && !user) {
    const redirectUrl = new URL("/login", request.url);
    const returnTo = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    redirectUrl.searchParams.set("next", returnTo);
    return NextResponse.redirect(redirectUrl);
  }

  if (isAuthOnlyPath && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}
