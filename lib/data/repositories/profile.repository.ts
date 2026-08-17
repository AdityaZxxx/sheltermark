import type { SupabaseClient } from "@supabase/supabase-js";

import type { ActionResult } from "~/lib/action-result";
import type {
  BookmarkPreview,
  WorkspaceWithBookmarks,
} from "~/lib/schemas/bookmark.schema";
import type { Profile } from "~/lib/schemas/profile.schema";

import { logger } from "~/lib/logger";
import {
  getProfileByUsernameSchema,
  type UpdateProfileInput,
  type UpdatePublicProfileInput,
  updateProfileSchema,
  updatePublicProfileSchema,
} from "~/lib/schemas/profile.schema";
import { createAdminClient } from "~/utils/supabase/server";

/** Editable profile columns accepted by {@link updateProfile}. */
type ProfileEditPatch = {
  name: string;
  trash_cleanup_interval?: number;
};

/** Ensure a URL value has a scheme; prefix bare handles/values. */
function normalizeProfileUrl(
  value: string | null | undefined,
  prefix: string,
): string | null {
  if (!value) return null;
  return value.startsWith("http") ? value : `${prefix}${value}`;
}

// Helper: delete avatar from storage (moved logic)
async function deleteAvatarFromStorage(
  supabase: SupabaseClient,
  avatarUrl: string | null,
): Promise<{ error?: string }> {
  if (!avatarUrl) return {};
  try {
    const url = new URL(avatarUrl);
    const pathParts = url.pathname.split("/");
    const fileName = pathParts
      .slice(pathParts.indexOf("avatars") + 1)
      .join("/");
    const { error: deleteError } = await supabase.storage
      .from("avatars")
      .remove([fileName]);
    if (deleteError) {
      return { error: deleteError.message };
    }
    return {};
  } catch {
    return { error: "Failed to parse avatar URL" };
  }
}

export async function updateProfile(
  supabase: SupabaseClient,
  userId: string,
  data: UpdateProfileInput,
): Promise<ActionResult<{ message: string }>> {
  const validated = updateProfileSchema.safeParse(data);
  if (!validated.success) {
    const msg = validated.error?.issues?.[0]?.message ?? "Invalid profile data";
    return { success: false, error: msg };
  }

  const { name, trash_cleanup_interval } = validated.data;

  const { error: authError } = await supabase.auth.updateUser({
    data: { name },
  });

  if (authError) {
    return { success: false, error: authError.message };
  }

  const profileUpdate: ProfileEditPatch = { name };
  if (trash_cleanup_interval !== undefined) {
    profileUpdate.trash_cleanup_interval = trash_cleanup_interval;
  }

  const { error: updateProfileError } = await supabase
    .from("profiles")
    .update(profileUpdate)
    .eq("id", userId);

  if (updateProfileError) {
    return { success: false, error: updateProfileError.message };
  }
  return { success: true, data: { message: "Profile updated successfully" } };
}

export async function updatePublicProfile(
  supabase: SupabaseClient,
  userId: string,
  data: UpdatePublicProfileInput,
): Promise<ActionResult<{ message: string }>> {
  const validated = updatePublicProfileSchema.safeParse(data);
  if (!validated.success) {
    const msg = validated.error?.issues?.[0]?.message ?? "Invalid profile data";
    return { success: false, error: msg };
  }

  let { username, is_public, bio, github_username, x_username, website } =
    validated.data;

  username = username.toLowerCase().trim();

  const { data: existingProfile, error: checkError } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .neq("id", userId)
    .single();

  if (checkError && checkError.code !== "PGRST116") {
    return { success: false, error: "Error checking username availability" };
  }

  if (existingProfile) {
    return { success: false, error: "Username is already taken" };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      username,
      is_public,
      bio,
      github_url: normalizeProfileUrl(github_username, "https://github.com/"),
      x_url: normalizeProfileUrl(x_username, "https://x.com/"),
      website_url: normalizeProfileUrl(website, "https://"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  return {
    success: true,
    data: { message: "Public profile updated successfully" },
  };
}

export async function getProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<ActionResult<{ profile: Profile }>> {
  const { data: profile, error: getProfileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (getProfileError) {
    return { success: false, error: getProfileError.message };
  }

  // SAFETY: select("*").single() scopes to the authenticated user's profile row, matching the Profile schema shape.
  return { success: true, data: { profile: profile as Profile } };
}

// New: Get profile display name by username if public
export async function getProfileDisplayName(
  supabase: SupabaseClient,
  username: { username: string },
): Promise<ActionResult<string | null>> {
  const validated = getProfileByUsernameSchema.safeParse(username);
  if (!validated.success) {
    // Keep behavior consistent with existing action layer: return generic invalid username
    return { success: false, error: "Invalid username" };
  }

  // Only fetch the name if the profile is public
  const { data } = await supabase
    .from("profiles")
    .select("name")
    .eq("username", username.username)
    .eq("is_public", true)
    .single();

  // Preserve original behavior: do not surface errors from Supabase, just return name or null
  // Note: we ignore the error field intentionally to mirror action.ts behavior
  return { success: true, data: data?.name ?? null };
}

// New: Get public profile and workspaces with bookmarks for a given username
export async function getPublicProfile(
  supabase: SupabaseClient,
  username: string,
): Promise<
  ActionResult<{ profile?: Profile; workspaces: WorkspaceWithBookmarks[] }>
> {
  const cleanUsername = username.trim().toLowerCase();
  if (!cleanUsername) {
    return { success: false, error: "Invalid username" };
  }

  // Fetch public profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", cleanUsername)
    .eq("is_public", true)
    .maybeSingle();

  if (profileError || !profile) {
    return { success: false, error: "Profile not found" };
  }

  // Fetch associated workspaces with bookmarks that are public
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
      success: false,
      error: `Failed to fetch workspaces: ${workspacesError.message}`,
    };
  }

  const workspacesWithBookmarks: WorkspaceWithBookmarks[] = (
    workspaces || []
  ).map((ws) => ({
    id: ws.id,
    name: ws.name,
    bookmarks: (ws.bookmarks || []).map((b: BookmarkPreview) => ({
      id: b.id,
      url: b.url,
      title: b.title,
      favicon_url: b.favicon_url,
      og_image_url: b.og_image_url,
      created_at: b.created_at,
      updated_at: b.updated_at,
    })),
  }));

  // Construct a Profile object without using type casts
  const profileObj: Profile = {
    id: profile.id,
    username: profile.username,
    name: profile.name,
    avatar_url: profile.avatar_url,
    bio: profile.bio,
    github_url: profile.github_url,
    x_url: profile.x_url,
    website_url: profile.website_url,
    is_public: profile.is_public,
    trash_cleanup_interval: profile.trash_cleanup_interval,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
  };

  return {
    success: true,
    data: {
      profile: profileObj,
      workspaces: workspacesWithBookmarks,
    },
  };
}

export async function uploadAvatar(
  supabase: SupabaseClient,
  userId: string,
  formData: FormData,
): Promise<ActionResult<{ avatarUrl: string }>> {
  // SAFETY: the multipart form only ever carries a binary file under "file"; text entries are validated below via !file/type checks.
  const file = formData.get("file") as File;
  if (!file) {
    return { success: false, error: "No file provided" };
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return {
      success: false,
      error: "Invalid file type. Only JPEG, PNG, and WebP are allowed",
    };
  }

  const maxSize = 2 * 1024 * 1024; // 2MB
  if (file.size > maxSize) {
    return { success: false, error: "File too large. Maximum size is 2MB" };
  }

  try {
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", userId)
      .single();

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const sharp = (await import("sharp")).default;
    const processedBuffer = await sharp(buffer)
      .rotate()
      .resize({ width: 512, height: 512, fit: "inside" })
      .webp({ quality: 85 })
      .toBuffer();

    const timestamp = Date.now();
    const fileName = `${userId}/${timestamp}.webp`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(fileName, processedBuffer, {
        contentType: "image/webp",
        cacheControl: "3600",
      });
    if (uploadError) {
      return { success: false, error: uploadError.message };
    }

    const existingAvatarUrl = currentProfile?.avatar_url;
    if (existingAvatarUrl) {
      await deleteAvatarFromStorage(supabase, existingAvatarUrl);
    }

    const { data: publicUrlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(fileName);
    const avatarUrl = publicUrlData.publicUrl;

    const { error: authError } = await supabase.auth.updateUser({
      data: { avatar_url: avatarUrl },
    });
    if (authError) {
      return { success: false, error: authError.message };
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (profileError) {
      return { success: false, error: profileError.message };
    }
    return { success: true, data: { avatarUrl } };
  } catch (error) {
    logger.error("Failed to upload avatar", { error, userId });
    return { success: false, error: "Failed to upload avatar" };
  }
}

export async function deleteAvatar(
  supabase: SupabaseClient,
  userId: string,
): Promise<ActionResult<null>> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", userId)
    .single();

  try {
    if (profile?.avatar_url) {
      await deleteAvatarFromStorage(supabase, profile.avatar_url);
    }
    const { error: authError } = await supabase.auth.updateUser({
      data: { avatar_url: null },
    });
    if (authError) return { success: false, error: authError.message };
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ avatar_url: null, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (profileError) return { success: false, error: profileError.message };
    return { success: true, data: null };
  } catch (error) {
    logger.error("Failed to delete avatar", { error, userId });
    return { success: false, error: "Failed to delete avatar" };
  }
}

export async function deleteAccount(
  supabase: SupabaseClient,
  userId: string,
): Promise<ActionResult<null>> {
  const adminClient = await createAdminClient();
  try {
    // Delete profile via admin client
    const { error: deleteProfileError } = await adminClient
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (deleteProfileError) {
      return {
        success: false,
        error: `Failed to delete profile: ${deleteProfileError.message}`,
      };
    }

    // Get avatar URL before removing profile, then delete avatar storage if present
    const { data: profile } = await adminClient
      .from("profiles")
      .select("avatar_url")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.avatar_url) {
      await deleteAvatarFromStorage(supabase, profile.avatar_url);
    }

    // Delete auth user via admin client
    const { error: deleteUserError } =
      await adminClient.auth.admin.deleteUser(userId);
    if (deleteUserError) {
      return {
        success: false,
        error: `Failed to delete auth user: ${deleteUserError.message}`,
      };
    }
    return { success: true, data: null };
  } catch (error) {
    logger.error("Failed to delete account", { error, userId });
    return { success: false, error: "Failed to delete account" };
  }
}
