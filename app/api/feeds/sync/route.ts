import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // Verify cron secret (optional but recommended)
  const authHeader = request.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    // Import and run the sync script
    const { syncFeeds } = await import("~/scripts/sync-feeds");
    await syncFeeds();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Feed sync failed:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
