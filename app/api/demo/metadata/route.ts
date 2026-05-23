import { NextResponse } from "next/server";
import { z } from "zod";

import { logger } from "~/lib/logger";
import { fetchMetadata } from "~/lib/metadata";

const requestSchema = z.object({
  url: z.url("Invalid URL format"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = requestSchema.safeParse(body);

    if (!validated.success) {
      const message =
        validated.error?.issues?.[0]?.message ?? "Invalid request";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const url = validated.data?.url;
    if (!url) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }
    const metadata = await fetchMetadata(url);
    return NextResponse.json(metadata);
  } catch (error) {
    logger.error("Demo metadata fetch error", { error });
    return NextResponse.json(
      { error: "Failed to fetch metadata" },
      { status: 500 },
    );
  }
}
