import { NextResponse } from "next/server";
import { createClient } from "~/utils/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ workspaces: [] }, { status: 200 });
    }

    const { data: workspaces, error } = await supabase
      .from("workspaces")
      .select("id, name, is_default")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ workspaces: workspaces || [] });
  } catch (error) {
    console.error("Extension workspaces error:", error);
    return NextResponse.json(
      { error: "Failed to fetch workspaces" },
      { status: 500 },
    );
  }
}
