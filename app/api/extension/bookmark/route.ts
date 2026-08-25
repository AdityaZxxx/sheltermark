import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { withExtension } from "~/app/api/extension/_lib/with-extension";
import { getDb } from "~/lib/data/db";
import { insertBookmark } from "~/lib/data/repositories/bookmark.repository";
import { workspaces } from "~/lib/data/schema";
import { extensionBookmarkSaveSchema } from "~/lib/schemas/extension.schema";

export const POST = withExtension(
  {
    scope: "bookmark save",
    bodySchema: extensionBookmarkSaveSchema,
    failureMessage: "Failed to save bookmark",
  },
  async ({ user, body }) => {
    const { url, workspace_id, title: clientTitle, tags } = body;

    // Protocol whitelist before persisting — prevents stored XSS via
    // javascript:/data: URLs, which z.url() accepts.
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

    let workspaceId: string | null = workspace_id ?? null;

    if (!workspaceId) {
      const db = getDb();
      const defaultWorkspaces = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(
          and(eq(workspaces.user_id, user.id), eq(workspaces.is_default, true)),
        )
        .limit(1);

      const defaultWorkspace = defaultWorkspaces[0];
      if (!defaultWorkspace) {
        return NextResponse.json(
          { error: "No workspace selected and no default workspace found" },
          { status: 400 },
        );
      }

      workspaceId = defaultWorkspace.id;
    }

    const result = await insertBookmark(getDb(), user.id, {
      url,
      workspaceId,
      clientTitle: clientTitle ?? null,
      tagNames: tags,
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

    return NextResponse.json({
      success: true,
      data: { ...result.data, tags: result.tags },
    });
  },
);
