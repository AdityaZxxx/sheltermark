import { requireAuthSafe } from "~/lib/auth";
import type { WorkspaceWithBookmarks } from "~/lib/schemas/bookmark";
import {
  getProfileByUsernameSchema,
  type Profile,
} from "~/lib/schemas/profile";

export async function getProfileDisplayName(username: {
  username: string;
}): Promise<string | null> {
  const { supabase } = await requireAuthSafe();

  const validateUsername = getProfileByUsernameSchema.safeParse(username);

  if (!validateUsername.success) {
    return null;
  }

  const { data } = await supabase
    .from("profiles")
    .select("name")
    .eq("username", username.username)
    .eq("is_public", true)
    .single();

  return data?.name ?? null;
}

export async function getPublicProfile(username: string): Promise<{
  profile?: Profile;
  workspaces: WorkspaceWithBookmarks[];
  error?: string;
}> {
  if (!username || typeof username !== "string") {
    return { error: "Invalid username", workspaces: [] };
  }

  const cleanUsername = username.trim().toLowerCase();

  if (!cleanUsername) {
    return { error: "Invalid username", workspaces: [] };
  }

  const { supabase } = await requireAuthSafe();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", cleanUsername)
    .eq("is_public", true)
    .maybeSingle();

  if (profileError || !profile) {
    return { error: "Profile not found", workspaces: [] };
  }

  const { data: workspaces, error: workspacesError } = await supabase
    .from("workspaces")
    .select(
      "id, name, bookmarks(id, url, title, favicon_url, og_image_url, created_at, updated_at)",
    )
    .eq("user_id", profile.id)
    .eq("is_public", true)
    .order("created_at", { ascending: true });

  if (workspacesError) {
    return {
      error: `Failed to fetch workspaces: ${workspacesError.message}`,
      workspaces: [],
    };
  }

  const workspacesWithBookmarks: WorkspaceWithBookmarks[] = (
    workspaces || []
  ).map((ws) => ({
    id: ws.id,
    name: ws.name,
    bookmarks: (ws.bookmarks || []).map((b) => ({
      id: b.id,
      url: b.url,
      title: b.title,
      favicon_url: b.favicon_url,
      og_image_url: b.og_image_url,
      created_at: b.created_at,
      updated_at: b.updated_at,
    })),
  }));

  return {
    profile: {
      id: profile.id,
      username: profile.username,
      name: profile.name,
      avatar_url: profile.avatar_url,
      bio: profile.bio,
      github_url: profile.github_url,
      x_url: profile.x_url,
      website_url: profile.website_url,
      is_public: profile.is_public,
      updated_at: profile.updated_at,
      created_at: profile.created_at,
    },
    workspaces: workspacesWithBookmarks,
  };
}
