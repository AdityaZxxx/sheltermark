"use server";

import { requireAuth } from "~/lib/auth";
import { updateProfileSchema, updatePublicProfileSchema } from "~/lib/schemas";

export async function updateProfile(data: { full_name: string }) {
  const { user, supabase } = await requireAuth();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const validated = updateProfileSchema.safeParse(data);

  if (!validated.success) {
    return { error: validated.error.issues[0].message };
  }

  const { full_name } = validated.data;

  const { error: authError } = await supabase.auth.updateUser({
    data: { full_name },
  });

  if (authError) {
    return { error: authError.message };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: full_name,
    })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  return { success: true, message: "Profile updated successfully", user };
}

export async function updatePublicProfile(data: {
  username: string;
  is_public: boolean;
  bio?: string;
  github_username?: string;
  x_username?: string;
  website?: string;
  current_username?: string;
}) {
  const { user, supabase } = await requireAuth();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const validated = updatePublicProfileSchema.safeParse(data);

  if (!validated.success) {
    return { error: validated.error.issues[0].message };
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
    return { error: "Error checking username availability" };
  }

  if (existingProfile) {
    return { error: "Username is already taken" };
  }

  // Helper to normalize URLs
  const normalizeUrl = (value: string | undefined, prefix: string) => {
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
    return { error: error.message };
  }

  return { success: true, message: "Public profile updated successfully" };
}

export async function getProfile() {
  const { user, supabase } = await requireAuth();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("username, bio, github_url, x_url, website_url, is_public")
    .eq("id", user.id)
    .single();

  if (error) {
    return { error: error.message };
  }

  return { profile };
}

export async function checkUsernameAvailability(data: {
  username: string;
  current_username?: string;
}) {
  const { user, supabase } = await requireAuth();

  if (!user) {
    return { error: "Unauthorized" };
  }

  let { username, current_username } = data;

  if (!username || username.length < 3) {
    return { error: "Username too short" };
  }

  // Normalize username to lowercase
  username = username.toLowerCase().trim();

  // Skip if same as user's current username from profiles table
  if (current_username && username === current_username.toLowerCase()) {
    return { available: true };
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
    return { error: error.message, available: false };
  }

  if (existingProfile) {
    return { available: false, message: "Username is already taken" };
  }

  return { available: true, message: "Username is available" };
}
