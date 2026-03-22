import { NextResponse } from "next/server";
import { getTagsWithCount } from "~/lib/data/repositories/tag.repository";
import { logger } from "~/lib/logger";
import { createClient } from "~/utils/supabase/server";

/**
 * Tag suggestions for the extension popup. Tags are user-scoped (not
 * workspace-scoped), so this intentionally returns every tag the user owns —
 * workspace filters are not applied. Counts are included only for ranking.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { authenticated: false, tags: [] },
        { status: 200 },
      );
    }

    const result = await getTagsWithCount(supabase, user.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ authenticated: true, tags: result.data ?? [] });
  } catch (error) {
    logger.error("Extension tags error", { error });
    return NextResponse.json(
      { authenticated: false, tags: [] },
      { status: 500 },
    );
  }
}
