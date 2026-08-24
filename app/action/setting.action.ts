"use server";

import type { ActionResult } from "~/lib/action-result";
import type {
  Profile,
  UpdateProfileInput,
  UpdatePublicProfileInput,
} from "~/lib/schemas/profile.schema";

import { requireAuth } from "~/lib/auth";
import { getDb } from "~/lib/data/db";
import {
  deleteAccount as deleteAccountRepo,
  deleteAvatar as deleteAvatarRepo,
  getProfile as getProfileRepo,
  updateProfile as updateProfileRepo,
  updatePublicProfile as updatePublicProfileRepo,
  uploadAvatar as uploadAvatarRepo,
} from "~/lib/data/repositories/profile.repository";
import { logger } from "~/lib/utils/logger";

export async function updateProfile(
  data: UpdateProfileInput,
): Promise<ActionResult<{ message: string }>> {
  const { user, supabase } = await requireAuth();
  return updateProfileRepo(getDb(), supabase, user.id, data);
}

export async function updatePublicProfile(
  data: UpdatePublicProfileInput,
): Promise<ActionResult<{ message: string }>> {
  const { user } = await requireAuth();
  return updatePublicProfileRepo(getDb(), user.id, data);
}

export async function getProfile(): Promise<
  ActionResult<{ profile: Profile }>
> {
  const { user } = await requireAuth();
  return getProfileRepo(getDb(), user.id);
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

  username = username.toLowerCase().trim();

  if (current_username && username === current_username.toLowerCase()) {
    return { success: true, data: { available: true } };
  }

  const { data: existingProfile, error } = await supabase
    .from("profiles")
    .select("id, username")
    .ilike("username", username)
    .neq("id", user.id)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    logger.error("Username availability check failed", { error });
    return {
      success: false,
      error: "Unable to check username. Please try again.",
    };
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
  return uploadAvatarRepo(getDb(), supabase, user.id, formData);
}

export async function deleteAvatar(): Promise<ActionResult<null>> {
  const { user, supabase } = await requireAuth();
  return deleteAvatarRepo(getDb(), supabase, user.id);
}

export async function deleteAccount(): Promise<ActionResult<null>> {
  const { user, supabase } = await requireAuth();
  return deleteAccountRepo(getDb(), supabase, user.id);
}
