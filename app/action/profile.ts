import { requireAuthSafe } from "~/lib/auth";
import type { Profile } from "~/types/profile.types";
import type { WorkspaceWithBookmarks } from "~/types/workspace.types";

export async function getProfileDisplayName(
  username: string,
): Promise<string | null> {
  const { supabase } = await requireAuthSafe();

  const { data } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("username", username)
    .eq("is_public", true)
    .single();

  return data?.full_name ?? null;
}

export async function getPublicProfile(username: string): Promise<{
  profile?: Profile;
  workspaces: WorkspaceWithBookmarks[];
  error?: string;
}> {
  const { supabase } = await requireAuthSafe();

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
        })),
      });
    }
  }

  return {
    profile: {
      id: profile.id,
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
