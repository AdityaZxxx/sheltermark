import fs from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { getProfileDisplayName } from "~/app/action/profile";
import { OGImage } from "~/components/og/og-image";

const interRegular = fs.readFileSync(
  path.join(process.cwd(), "assets/Inter_18pt-Regular.ttf"),
);

const interBold = fs.readFileSync(
  path.join(process.cwd(), "assets/Inter_18pt-SemiBold.ttf"),
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
    display_name = (await getProfileDisplayName(username)) ?? undefined;
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
