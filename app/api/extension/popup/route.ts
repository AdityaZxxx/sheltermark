import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "~/lib/supabase/server";
import { normalizeUrl } from "~/lib/utils";
import { logger } from "~/lib/utils/logger";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");
    const workspaceId = searchParams.get("workspace_id");

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { authenticated: false, workspaces: [], lastWorkspace: null },
        { status: 200 },
      );
    }

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
  } catch (error) {
    logger.error("Extension popup error", { error });
    return NextResponse.json(
      { authenticated: false, workspaces: [], lastWorkspace: null },
      { status: 500 },
    );
  }
}

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
