import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "~/utils/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");
    const workspaceId = searchParams.get("workspace_id");

    if (!url) {
      return NextResponse.json(
        { error: "url parameter is required" },
        { status: 400 },
      );
    }

    // Validate protocol — consistent with bookmark route
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
      return NextResponse.json({ saved: false }, { status: 200 });
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ saved: false }, { status: 200 });
    }

    let query = supabase
      .from("bookmarks")
      .select("id")
      .eq("user_id", user.id)
      .eq("url", url);

    if (workspaceId) {
      query = query.eq("workspace_id", workspaceId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      return NextResponse.json({ saved: false }, { status: 200 });
    }

    return NextResponse.json({
      saved: !!data,
      bookmark_id: data?.id ?? null,
    });
  } catch (error) {
    console.error("Extension check error:", error);
    return NextResponse.json({ saved: false }, { status: 200 });
  }
}
