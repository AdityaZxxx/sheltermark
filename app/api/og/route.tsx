import type { NextRequest } from "next/server";

import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getProfileDisplayName } from "~/app/action/profile.action";
import { OGImage } from "~/components/og/og-image";

const interRegular = readFileSync(
  join(process.cwd(), "assets/Inter_18pt-Regular.ttf"),
);

const interBold = readFileSync(
  join(process.cwd(), "assets/Inter_18pt-SemiBold.ttf"),
);

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const title = searchParams.get("title") || "Sheltermark";
  const description =
    searchParams.get("description") || "Safe place for your bookmarks";
  const username = searchParams.get("username") || undefined;
  const workspace = searchParams.get("workspace") || undefined;

  let display_name: string | undefined;

  if (username) {
    const res = await getProfileDisplayName({ username });
    display_name = res.success ? (res.data ?? undefined) : undefined;
  }

  return new ImageResponse(
    <OGImage
      title={title}
      description={description}
      display_name={display_name}
      username={username}
      workspace={workspace}
    />,
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: "Inter",
          data: interRegular,
          weight: 400,
          style: "normal",
        },
        {
          name: "Inter",
          data: interBold,
          weight: 700,
          style: "normal",
        },
      ],
    },
  );
}
