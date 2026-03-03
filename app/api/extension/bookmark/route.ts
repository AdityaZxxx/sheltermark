import { NextResponse } from "next/server";
import { insertBookmark } from "~/lib/bookmark";
import { createClient } from "~/utils/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { url, workspace_id, title: clientTitle } = body;

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate protocol before persisting — prevents stored XSS via javascript:/data: URLs
    const parsed = (() => {
      try {
        return new URL(url);
      } catch {
        return null;
      }
    })();
    if (
      !parsed ||
      (parsed.protocol !== "http:" && parsed.protocol !== "https:")
    ) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve workspace: if none provided, fall back to user's default
    let workspaceId: string | null = workspace_id ?? null;

    if (!workspaceId) {
      const { data: defaultWorkspace } = await supabase
        .from("workspaces")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_default", true)
        .maybeSingle();

      if (!defaultWorkspace) {
        return NextResponse.json(
          { error: "No workspace selected and no default workspace found" },
          { status: 400 },
        );
      }

      workspaceId = defaultWorkspace.id;
    }

    const result = await insertBookmark(supabase, user.id, {
      url,
      workspaceId,
      clientTitle: clientTitle ?? null,
    });

    if (!result.success) {
      if (result.duplicate) {
        return NextResponse.json(
          { error: "Bookmark already exists" },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error("Extension bookmark error:", error);
    return NextResponse.json(
      { error: "Failed to save bookmark" },
      { status: 500 },
    );
  }
}
