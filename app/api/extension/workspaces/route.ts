import { NextResponse } from "next/server";

import { withExtension } from "~/app/api/extension/_lib/with-extension";
import { createClient } from "~/lib/supabase/server";

export const GET = withExtension(
  {
    scope: "workspaces fetch",
    failureMessage: "Failed to fetch workspaces",
    unauthorized: () =>
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  },
  async ({ user }) => {
    const supabase = await createClient();
    const { data: workspaces, error } = await supabase
      .from("workspaces")
      .select("id, name, is_default")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ workspaces: workspaces || [] });
  },
);
