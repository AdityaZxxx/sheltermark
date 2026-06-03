import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchMetadata } from "~/lib/metadata";

const requestSchema = z.object({
  url: z.url("Invalid URL format"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = requestSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.issues[0].message },
        { status: 400 },
      );
    }

    const metadata = await fetchMetadata(validated.data.url);
    return NextResponse.json(metadata);
  } catch (error) {
    console.error("Demo metadata fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch metadata" },
      { status: 500 },
    );
  }
}
