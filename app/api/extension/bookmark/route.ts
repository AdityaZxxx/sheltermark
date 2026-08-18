import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "~/lib/data/drizzle";
import { insertBookmark } from "~/lib/data/repositories/bookmark.repository";
import { workspaces } from "~/lib/data/schema";
import { logger } from "~/lib/logger";
import { extensionBookmarkSaveSchema } from "~/lib/schemas/extension.schema";
import { createClient } from "~/utils/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = extensionBookmarkSaveSchema.safeParse(body);

    if (!validated.success) {
      const message =
        validated.error?.issues?.[0]?.message ?? "Invalid request";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { url, workspace_id, title: clientTitle, tags } = validated.data;

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate protocol before persisting — prevents stored XSS via javascript:/data: URLs
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

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let workspaceId: string | null = workspace_id ?? null;

    if (!workspaceId) {
      const db = getDb();
      const defaultWorkspaces = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(
          and(eq(workspaces.userId, user.id), eq(workspaces.isDefault, true)),
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
  } catch (error) {
    logger.error("Extension bookmark error", { error });
    return NextResponse.json(
      { error: "Failed to save bookmark" },
      { status: 500 },
    );
  }
}
