import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    let url = formData.get("url")?.toString() || "";
    const text = formData.get("text")?.toString() || "";
    const title = formData.get("title")?.toString() || "";

    if (
      !url &&
      text &&
      (text.startsWith("http://") || text.startsWith("https://"))
    ) {
      url = text;
    } else if (!url && text) {
      const match = text.match(/https?:\/\/[^\s]+/);
      if (match) {
        url = match[0];
      }
    }

    const dest = new URL("/dashboard", request.url);

    if (url) {
      dest.searchParams.set("share_url", url);
    }
    if (title) {
      dest.searchParams.set("share_title", title);
    }

    return NextResponse.redirect(dest, { status: 303 });
  } catch {
    return NextResponse.redirect(new URL("/dashboard", request.url), {
      status: 303,
    });
  }
}
