import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { syncAllFeedsGlobal } from "~/lib/data/repositories/feed.repository";
import { logger } from "~/lib/logger";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { success: false, error: "Server misconfigured" },
      { status: 500 },
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const result = await syncAllFeedsGlobal(supabase);

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
