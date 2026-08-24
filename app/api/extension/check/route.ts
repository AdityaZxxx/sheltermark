import { NextResponse } from "next/server";

import { withExtension } from "~/app/api/extension/_lib/with-extension";
import { createClient } from "~/lib/supabase/server";
import { normalizeUrl } from "~/lib/utils";

export const GET = withExtension(
  {
    scope: "bookmark check",
    failureMessage: "Failed to check bookmark",
    // A failed check must never block saving — degrade to "not saved".
    unauthorized: () => NextResponse.json({ saved: false }, { status: 200 }),
    onUnexpected: () => NextResponse.json({ saved: false }, { status: 200 }),
  },
  async ({ req, user }) => {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
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

    // Match the insert path: stored URLs are normalized, so the raw tab URL
    // must be normalized before comparing or dupes pre-save are missed.
    const lookupUrl = normalizeUrl(url);

    let query = supabase
      .from("bookmarks")
      .select("id")
      .eq("user_id", user.id)
      .eq("url", lookupUrl);

    if (workspaceId) {
      query = query.eq("workspace_id", workspaceId);
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw error;

    return NextResponse.json({
      saved: !!data,
      bookmark_id: data?.id ?? null,
    });
  },
);
