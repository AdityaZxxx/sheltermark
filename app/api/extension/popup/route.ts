import { NextResponse } from "next/server";

import { withExtension } from "~/app/api/extension/_lib/with-extension";
import { createClient } from "~/lib/supabase/server";
import { normalizeUrl } from "~/lib/utils";

export const GET = withExtension(
  {
    scope: "popup init",
    failureMessage: "Failed to load popup",
    // The popup renders a logged-out state instead of an error surface.
    unauthorized: () =>
      NextResponse.json(
        { authenticated: false, workspaces: [], lastWorkspace: null },
        { status: 200 },
      ),
    onUnexpected: () =>
      NextResponse.json(
        { authenticated: false, workspaces: [], lastWorkspace: null },
        { status: 500 },
      ),
  },
  async ({ req, user }) => {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");
    const workspaceId = searchParams.get("workspace_id");

    const [{ data: workspaces }, bookmarkResult] = await Promise.all([
      supabase
        .from("workspaces")
        .select("id, name, is_default")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true }),
      url && workspaceId
        ? checkBookmark(supabase, user.id, url, workspaceId)
        : Promise.resolve({ saved: false, bookmarkId: null }),
    ]);

    return NextResponse.json({
      authenticated: true,
      workspaces: workspaces ?? [],
      lastWorkspace:
        workspaceId ??
        workspaces?.find((w) => w.is_default)?.id ??
        workspaces?.[0]?.id ??
        null,
      alreadySaved: bookmarkResult.saved,
      bookmarkId: bookmarkResult.bookmarkId,
    });
  },
);

async function checkBookmark(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  url: string,
  workspaceId: string,
) {
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
    return { saved: false, bookmarkId: null };
  }

  // Stored URLs are normalized on insert; normalize here too or the
  // "already saved" check misses dupes for the raw tab URL.
  const lookupUrl = normalizeUrl(url);

  const { data, error } = await supabase
    .from("bookmarks")
    .select("id")
    .eq("user_id", userId)
    .eq("url", lookupUrl)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) return { saved: false, bookmarkId: null };
  return { saved: !!data, bookmarkId: data?.id ?? null };
}
