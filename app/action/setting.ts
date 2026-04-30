"use server";

import type { ActionResult } from "~/lib/action-result";
import { requireAuth } from "~/lib/auth";
import type { Profile } from "~/lib/schemas/profile";
import { createAdminClient } from "~/utils/supabase/server";
import {
  type UpdateProfileInput,
  type UpdatePublicProfileInput,
  updateProfileSchema,
  updatePublicProfileSchema,
} from "../../lib/schemas/profile";

// Helper to delete avatar file from storage
async function deleteAvatarFromStorage(
  supabase: Awaited<ReturnType<typeof requireAuth>>["supabase"],
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
      console.error("Failed to delete avatar from storage:", deleteError);
      return { error: deleteError.message };
    }

    return {};
  } catch (error) {
    console.error("Error parsing avatar URL:", error);
    return { error: "Failed to parse avatar URL" };
  }
}

export async function updateProfile(
  data: UpdateProfileInput,
): Promise<ActionResult<{ message: string }>> {
  const { user, supabase } = await requireAuth();

  const validated = updateProfileSchema.safeParse(data);

  if (!validated.success) {
    return { success: false, error: validated.error.issues[0].message };
  }

  const { name } = validated.data;

  const { error: authError } = await supabase.auth.updateUser({
    data: { name },
  });

  if (authError) {
    return { success: false, error: authError.message };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      name: name,
    })
    .eq("id", user.id);

  if (error) {
    return { success: false, error: error.message };
  }
  return {
    success: true,
    data: { message: "Profile updated successfully" },
  };
}

export async function updatePublicProfile(
  data: UpdatePublicProfileInput,
): Promise<ActionResult<{ message: string }>> {
  const { user, supabase } = await requireAuth();

  const validated = updatePublicProfileSchema.safeParse(data);

  if (!validated.success) {
    return { success: false, error: validated.error.issues[0].message };
  }

  let { username, is_public, bio, github_username, x_username, website } =
    validated.data;

  // Normalize username to lowercase for consistency
  username = username.toLowerCase().trim();

  // Check if username is already taken by another user
  const { data: existingProfile, error: checkError } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .neq("id", user.id)
    .single();

  // PGRST116 = no rows found (username is available)
  // Any other error or if profile exists = username taken
  if (checkError && checkError.code !== "PGRST116") {
    return { success: false, error: "Error checking username availability" };
  }

  if (existingProfile) {
    return { success: false, error: "Username is already taken" };
  }

  // Helper to normalize URLs
  const normalizeUrl = (value: string | null | undefined, prefix: string) => {
    if (!value) return null;
    return value.startsWith("http") ? value : `${prefix}${value}`;
  };

  // Update public profile
  const { error } = await supabase
    .from("profiles")
    .update({
      username,
      is_public,
      bio,
      github_url: normalizeUrl(github_username, "https://github.com/"),
      x_url: normalizeUrl(x_username, "https://x.com/"),
      website_url: normalizeUrl(website, "https://"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    data: { message: "Public profile updated successfully" },
  };
}

export async function getProfile(): Promise<
  ActionResult<{ profile: Profile }>
> {
  const { user, supabase } = await requireAuth();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: { profile } };
}

export async function checkUsernameAvailability(data: {
  username: string;
  current_username?: string;
}) {
  const { user, supabase } = await requireAuth();

  let { username, current_username } = data;

  if (!username || username.length < 3) {
    return { success: false, error: "Username too short" };
  }

  // Normalize username to lowercase
  username = username.toLowerCase().trim();

  // Skip if same as user's current username from profiles table
  if (current_username && username === current_username.toLowerCase()) {
    return { success: true, data: { available: true } };
  }

  // Check if username is already taken by another user (case-insensitive)
  const { data: existingProfile, error } = await supabase
    .from("profiles")
    .select("id, username")
    .ilike("username", username)
    .neq("id", user.id)
    .maybeSingle();

  // If error and not "no rows found"
  if (error && error.code !== "PGRST116") {
    return { success: false, error: error.message };
  }

  if (existingProfile) {
    return {
      success: true,
      data: { available: false, message: "Username is already taken" },
    };
  }
  return {
    success: true,
    data: { available: true, message: "Username is available" },
  };
}

export async function uploadAvatar(
  formData: FormData,
): Promise<ActionResult<{ avatarUrl: string }>> {
  const { user, supabase } = await requireAuth();

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
    // Get current avatar to delete it later
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .single();

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Process image with sharp
    const sharp = (await import("sharp")).default;
    const processedBuffer = await sharp(buffer)
      .rotate() // Auto-rotate based on EXIF
      .resize({ width: 512, height: 512, fit: "inside" })
      .webp({ quality: 85 })
      .toBuffer();

    // Generate unique filename
    const timestamp = Date.now();
    const fileName = `${user.id}/${timestamp}.webp`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(fileName, processedBuffer, {
        contentType: "image/webp",
        cacheControl: "3600",
      });

    if (uploadError) {
      return { success: false, error: uploadError.message };
    }

    // Delete old avatar after successful upload
    if (currentProfile?.avatar_url) {
      const deleteResult = await deleteAvatarFromStorage(
        supabase,
        currentProfile.avatar_url,
      );
      if (deleteResult.error) {
        // Log error but don't fail the upload - old file can be cleaned up later
        console.error("Failed to delete old avatar:", deleteResult.error);
      }
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
      .update({
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (profileError) {
      return { success: false, error: profileError.message };
    }
    return { success: true, data: { avatarUrl } };
  } catch (error) {
    console.error("Avatar upload error:", error);
    return { success: false, error: "Failed to upload avatar" };
  }
}

export async function deleteAvatar(): Promise<ActionResult<null>> {
  const { user, supabase } = await requireAuth();

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .single();

    if (profile?.avatar_url) {
      const deleteResult = await deleteAvatarFromStorage(
        supabase,
        profile.avatar_url,
      );
      if (deleteResult.error) {
        console.error(
          "Failed to delete avatar from storage:",
          deleteResult.error,
        );
        // Continue anyway to update database
      }
    }

    const { error: authError } = await supabase.auth.updateUser({
      data: { avatar_url: null },
    });

    if (authError) {
      return { success: false, error: authError.message };
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        avatar_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (profileError) {
      return { success: false, error: profileError.message };
    }

    return { success: true, data: null };
  } catch (error) {
    console.error("Avatar delete error:", error);
    return { success: false, error: "Failed to delete avatar" };
  }
}

export async function deleteAccount(): Promise<ActionResult<null>> {
  const { user } = await requireAuth();
  const adminClient = await createAdminClient();

  try {
    const { error: deleteProfileError } = await adminClient
      .from("profiles")
      .delete()
      .eq("id", user.id);

    if (deleteProfileError) {
      return {
        success: false,
        error: `Failed to delete profile: ${deleteProfileError.message}`,
      };
    }

    const { data: profile } = await adminClient
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.avatar_url) {
      const { supabase } = await requireAuth();
      await deleteAvatarFromStorage(supabase, profile.avatar_url);
    }

    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(
      user.id,
    );

    if (deleteUserError) {
      return {
        success: false,
        error: `Failed to delete auth user: ${deleteUserError.message}`,
      };
    }
    return { success: true, data: null };
  } catch (error) {
    console.error("Delete account error:", error);
    return { success: false, error: "Failed to delete account" };
  }
}
