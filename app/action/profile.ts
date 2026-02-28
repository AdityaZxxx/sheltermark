import { requireAuthSafe } from "~/lib/auth";

interface PublicProfile {
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  github_url: string | null;
  x_url: string | null;
  website_url: string | null;
  is_public: boolean;
  created_at: string;
}

interface Bookmark {
  id: string;
  title: string;
  url: string;
  description: string | null;
  favicon_url: string | null;
  og_image_url: string | null;
  created_at: string;
}

interface WorkspaceWithBookmarks {
  id: string;
  name: string;
  bookmarks: Bookmark[];
}

export async function getPublicProfile(username: string): Promise<{
  profile?: PublicProfile;
  workspaces: WorkspaceWithBookmarks[];
  error?: string;
}> {
  const {supabase} = await requireAuthSafe();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .eq("is_public", true)
    .single();

  if (profileError || !profile) {
    return { error: "Profile not found", workspaces: [] };
  }

  const { data: workspaces, error: workspacesError } = await supabase
    .from("workspaces")
    .select("*")
    .eq("user_id", profile.id)
    .eq("is_public", true)
    .order("created_at", { ascending: true });

  if (workspacesError || !workspaces) {
    return { error: "Failed to fetch workspaces", workspaces: [] };
  }

  const workspacesWithBookmarks: WorkspaceWithBookmarks[] = [];

  for (const workspace of workspaces) {
    const { data: bookmarks, error: bookmarksError } = await supabase
      .from("bookmarks")
      .select("id, url, title, favicon_url, og_image_url, created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false });

    if (!bookmarksError && bookmarks) {
      workspacesWithBookmarks.push({
        id: workspace.id,
        name: workspace.name,
        bookmarks: bookmarks.map((b) => ({
          ...b,
          description: null,
        })),
      });
    }
  }

  return {
    profile: {
      username: profile.username,
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
      bio: profile.bio,
      github_url: profile.github_url,
      x_url: profile.x_url,
      website_url: profile.website_url,
      is_public: profile.is_public,
      created_at: profile.created_at,
    },
    workspaces: workspacesWithBookmarks,
  };
}
