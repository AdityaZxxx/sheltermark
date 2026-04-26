import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url") || "";
  const title = searchParams.get("title") || "";

  const dest = new URL("/dashboard", request.url);

  if (url) {
    dest.searchParams.set("share_url", url);
  }
  if (title) {
    dest.searchParams.set("share_title", title);
  }

  return NextResponse.redirect(dest);
}
