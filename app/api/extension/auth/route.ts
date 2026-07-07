import { NextResponse } from "next/server";
import { createClient } from "~/utils/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Extension auth error:", error);
    return NextResponse.json(
      { authenticated: false, error: "Failed to check auth" },
      { status: 500 },
    );
  }
}
