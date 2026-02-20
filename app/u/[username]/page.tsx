import type { Metadata } from "next";
import { getPublicProfile } from "~/app/action/profile";
import { BookmarkViewReadOnly } from "~/components/bookmark/bookmark-view-readonly";
import { PublicHeader } from "~/components/profile/public-header";
import { PublicProfileSidebar } from "~/components/profile/public-profile-sidebar";
import { requireAuthSafe } from "~/lib/auth";
import { getBaseUrl } from "~/lib/utils";

interface PublicProfilePageProps {
  params: Promise<{
    username: string;
  }>;
  searchParams: Promise<{
    workspace?: string;
  }>;
}
export async function generateMetadata({
  params,
  searchParams,
}: PublicProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  const { workspace } = await searchParams;
  const result = await getPublicProfile(username);

  if (result.error || !result.profile) {
    return {
      title: "Profile not found — Sheltermark",
      openGraph: {
        title: "Profile not found — Sheltermark",
        images: [`${getBaseUrl()}/api/og?title=Profile%20not%20found`],
      },
    };
  }

  const { profile, workspaces } = result;
  const displayName = profile.full_name;
  let title: string;
  let description: string;

  const ogParams = new URLSearchParams({
    username: profile.username,
  });

  if (workspace) {
    const ws = workspaces.find((w) => w.name === workspace);
    if (ws) {
      title = `${ws.name} — ${displayName} (@${profile.username})`;
      description = `Explore bookmarks in ${ws.name} by ${displayName} on Sheltermark`;
      ogParams.set("workspace", ws.name);
    } else {
      title = `${displayName} (@${profile.username}) — Sheltermark`;
      description = `Check out ${profile.username}'s bookmarks on Sheltermark`;
    }
  } else {
    title = `${displayName} (@${profile.username}) — Sheltermark`;
    description = `Check out ${profile.username}'s bookmarks on Sheltermark`;
  }

  const ogUrl = `${getBaseUrl()}/api/og?${ogParams.toString()}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogUrl],
    },
  };
}

export default async function PublicProfilePage({
  params,
}: PublicProfilePageProps) {
  const { username } = await params;
  const result = await getPublicProfile(username);
  const { user } = await requireAuthSafe();

  if (result.error || !result.profile) {
    return (
      <div className="flex flex-col mx-auto items-center justify-center h-screen">
        <h3 className="text-foreground text-2xl">Profile not found</h3>
        <p className="text-muted-foreground">
          Please check the username and try again
        </p>
      </div>
    );
  }

  const { profile, workspaces } = result;

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <PublicHeader user={user} />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mt-10">
          <div className="lg:col-span-1">
            <div className="flex flex-col items-start text-left gap-4 sticky top-8">
              <PublicProfileSidebar profile={profile} />
            </div>
          </div>

          <div className="lg:col-span-3">
            <BookmarkViewReadOnly workspaces={workspaces} />
          </div>
        </div>
      </div>
    </div>
  );
}
