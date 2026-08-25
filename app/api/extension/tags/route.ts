import { NextResponse } from "next/server";

import { withExtension } from "~/app/api/extension/_lib/with-extension";
import { getDb } from "~/lib/data/db";
import { getTagsWithCount } from "~/lib/data/repositories/tag.repository";

/**
 * Tag suggestions for the extension popup. Tags are user-scoped (not
 * workspace-scoped), so this intentionally returns every tag the user owns —
 * workspace filters are not applied. Counts are included only for ranking.
 */
export const GET = withExtension(
  {
    scope: "tags fetch",
    failureMessage: "Failed to fetch tags",
    // The popup renders a logged-out state instead of an error surface.
    unauthorized: () =>
      NextResponse.json({ authenticated: false, tags: [] }, { status: 200 }),
    onUnexpected: () =>
      NextResponse.json({ authenticated: false, tags: [] }, { status: 500 }),
  },
  async ({ user }) => {
    const result = await getTagsWithCount(getDb(), user.id);
    if (!result.success) throw new Error(result.error);

    return NextResponse.json({
      authenticated: true,
      tags: result.data ?? [],
    });
  },
);
