import { NextResponse } from "next/server";

import { getDb } from "~/lib/data/db";
import { syncAllFeedsGlobal } from "~/lib/data/repositories/feed.repository";
import { logger } from "~/lib/utils/logger";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { success: false, error: "Server misconfigured" },
      { status: 500 },
    );
  }

  try {
    const result = await syncAllFeedsGlobal(getDb());

    if (!result.success) {
      logger.error("Feed sync failed", { error: result.error });
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      synced: result.data.synced,
      errors: result.data.errors,
    });
  } catch (error) {
    logger.error("Feed sync failed", { error });
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
