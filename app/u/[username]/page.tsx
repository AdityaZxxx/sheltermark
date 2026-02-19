import type { Metadata } from "next";
import { getPublicProfile } from "~/app/action/profile";
import { BookmarkViewReadOnly } from "~/components/bookmark/bookmark-view-readonly";
import { PublicProfileSidebar } from "~/components/profile/public-profile-sidebar";
import { PublicHeader } from "../../../components/profile/public-header";
import { requireAuthSafe } from "../../../lib/auth";

interface PublicProfilePageProps {
  params: Promise<{
    username: string;
  }>;
}

export async function generateMetadata({
  params,
}: PublicProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  const result = await getPublicProfile(username);

  if (result.error || !result.profile) {
    return {
      title: "Profile not found — Sheltermark",
    };
  }

  const { profile } = result;
  const displayName = profile.full_name || profile.username;

  return {
    title: `${displayName} (@${profile.username}) — Sheltermark`,
    description:
      profile.bio || `Check out ${profile.username}'s bookmarks on Sheltermark`,
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
    <div className="min-h-screen bg-background pb-12">
      <div className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
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
