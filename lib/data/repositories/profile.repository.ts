import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import { and, asc, eq, inArray, ne } from "drizzle-orm";

import type { ActionResult } from "~/lib/action-result";
import type { DrizzleDb } from "~/lib/data/db";
import type {
  BookmarkPreview,
  WorkspaceWithBookmarks,
} from "~/lib/schemas/bookmark.schema";
import type { Profile } from "~/lib/schemas/profile.schema";

import { bookmarks, profiles, workspaces } from "~/lib/data/schema";
import {
  getProfileByUsernameSchema,
  type UpdateProfileInput,
  type UpdatePublicProfileInput,
  updateProfileSchema,
  updatePublicProfileSchema,
  usernameSchema,
} from "~/lib/schemas/profile.schema";
import { createAdminClient } from "~/lib/supabase/server";
import { logger } from "~/lib/utils/logger";

type ProfileRow = typeof profiles.$inferSelect;

/** Editable profile columns accepted by {@link updateProfile}. */
type ProfileEditPatch = Partial<
  Pick<ProfileRow, "name" | "trashCleanupInterval">
>;

function toProfile(row: ProfileRow): Profile {
  const parsed = usernameSchema.safeParse(row.username);
  const username = parsed.success ? parsed.data : "";
  return {
    id: row.id,
    username,
    name: row.name,
    avatar_url: row.avatarUrl,
    bio: row.bio ?? undefined,
    website_url: row.websiteUrl,
    github_url: row.githubUrl,
    x_url: row.xUrl,
    is_public: row.isPublic,
    trash_cleanup_interval: row.trashCleanupInterval,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt?.toISOString() ?? null,
  };
}

function dbError(cause: unknown): ActionResult<never> {
  return {
    success: false,
    error: cause instanceof Error ? cause.message : "Database error",
  };
}

/** Ensure a URL value has a scheme; prefix bare handles/values. */
function normalizeProfileUrl(
  value: string | null | undefined,
  prefix: string,
): string | null {
  if (!value) return null;
  return value.startsWith("http") ? value : `${prefix}${value}`;
}

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

/**
 * SECURITY: Drizzle connects with the service-role credential and BYPASSES
 * ROW LEVEL SECURITY. Own-row reads/writes here key on `profiles.id`
 * directly; public reads re-implement the RLS SELECT policies
 * (`is_public = true`).
 */
export async function updateProfile(
  db: DrizzleDb,
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
    profileUpdate.trashCleanupInterval = trash_cleanup_interval;
  }

  try {
    await db.update(profiles).set(profileUpdate).where(eq(profiles.id, userId));
  } catch (cause) {
    return dbError(cause);
  }
  return { success: true, data: { message: "Profile updated successfully" } };
}

export async function updatePublicProfile(
  db: DrizzleDb,
  userId: string,
  data: UpdatePublicProfileInput,
): Promise<ActionResult<{ message: string }>> {
  const validated = updatePublicProfileSchema.safeParse(data);
  if (!validated.success) {
    const msg = validated.error?.issues?.[0]?.message ?? "Invalid profile data";
    return { success: false, error: msg };
  }

  const { username, is_public, bio, github_username, x_username, website } =
    validated.data;

  const cleanUsername = username.toLowerCase().trim();

  try {
    const taken = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(and(eq(profiles.username, cleanUsername), ne(profiles.id, userId)))
      .limit(1);

    if (taken.length > 0) {
      return { success: false, error: "Username is already taken" };
    }

    await db
      .update(profiles)
      .set({
        username: cleanUsername,
        isPublic: is_public,
        bio,
        githubUrl: normalizeProfileUrl(github_username, "https://github.com/"),
        xUrl: normalizeProfileUrl(x_username, "https://x.com/"),
        websiteUrl: normalizeProfileUrl(website, "https://"),
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, userId));
  } catch (cause) {
    return dbError(cause);
  }

  return {
    success: true,
    data: { message: "Public profile updated successfully" },
  };
}

export async function getProfile(
  db: DrizzleDb,
  userId: string,
): Promise<ActionResult<{ profile: Profile }>> {
  try {
    const [row] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    if (!row) {
      return { success: false, error: "Profile not found" };
    }

    return { success: true, data: { profile: toProfile(row) } };
  } catch (cause) {
    return dbError(cause);
  }
}

export async function getProfileDisplayName(
  db: DrizzleDb,
  username: { username: string },
): Promise<ActionResult<string | null>> {
  const validated = getProfileByUsernameSchema.safeParse(username);
  if (!validated.success) {
    return { success: false, error: "Invalid username" };
  }

  try {
    // RLS parity: the public-profile SELECT policy required is_public = true.
    const rows = await db
      .select({ name: profiles.name })
      .from(profiles)
      .where(
        and(
          eq(profiles.username, validated.data.username),
          eq(profiles.isPublic, true),
        ),
      )
      .limit(1);

    // A missing/private profile is not a failure here; callers get null.
    return { success: true, data: rows[0]?.name ?? null };
  } catch (cause) {
    return dbError(cause);
  }
}

export async function getPublicProfile(
  db: DrizzleDb,
  username: string,
): Promise<
  ActionResult<{ profile?: Profile; workspaces: WorkspaceWithBookmarks[] }>
> {
  const cleanUsername = username.trim().toLowerCase();
  if (!cleanUsername) {
    return { success: false, error: "Invalid username" };
  }

  try {
    const [profileRow] = await db
      .select()
      .from(profiles)
      .where(
        and(eq(profiles.username, cleanUsername), eq(profiles.isPublic, true)),
      )
      .limit(1);

    if (!profileRow) {
      return { success: false, error: "Profile not found" };
    }

    const workspaceRows = await db
      .select()
      .from(workspaces)
      .where(
        and(
          eq(workspaces.userId, profileRow.id),
          eq(workspaces.isPublic, true),
        ),
      )
      .orderBy(asc(workspaces.createdAt));

    const workspaceIds = workspaceRows.map((ws) => ws.id);

    let bookmarkRows: Array<typeof bookmarks.$inferSelect> = [];
    if (workspaceIds.length > 0) {
      bookmarkRows = await db
        .select()
        .from(bookmarks)
        .where(inArray(bookmarks.workspace_id, workspaceIds));
    }

    const bookmarksByWorkspace = new Map<string, BookmarkPreview[]>();
    for (const bm of bookmarkRows) {
      if (!bm.workspace_id) continue;
      const list = bookmarksByWorkspace.get(bm.workspace_id) ?? [];
      list.push({
        id: bm.id,
        url: bm.url,
        title: bm.title,
        favicon_url: bm.favicon_url,
        og_image_url: bm.og_image_url,
        created_at: bm.created_at,
        updated_at: bm.updated_at,
      });
      bookmarksByWorkspace.set(bm.workspace_id, list);
    }

    const workspacesWithBookmarks: WorkspaceWithBookmarks[] = workspaceRows.map(
      (ws) => ({
        id: ws.id,
        name: ws.name,
        bookmarks: bookmarksByWorkspace.get(ws.id) ?? [],
      }),
    );

    return {
      success: true,
      data: {
        profile: toProfile(profileRow),
        workspaces: workspacesWithBookmarks,
      },
    };
  } catch (cause) {
    return {
      success: false,
      error:
        cause instanceof Error
          ? `Failed to fetch workspaces: ${cause.message}`
          : "Failed to fetch workspaces: Database error",
    };
  }
}

export async function uploadAvatar(
  db: DrizzleDb,
  supabase: SupabaseClient,
  userId: string,
  formData: FormData,
): Promise<ActionResult<{ avatarUrl: string }>> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
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
    const [currentProfile] = await db
      .select({ avatarUrl: profiles.avatarUrl })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

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

    const existingAvatarUrl = currentProfile?.avatarUrl ?? null;
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

    await db
      .update(profiles)
      .set({ avatarUrl, updatedAt: new Date() })
      .where(eq(profiles.id, userId));
    return { success: true, data: { avatarUrl } };
  } catch (error) {
    logger.error("Failed to upload avatar", { error, userId });
    return { success: false, error: "Failed to upload avatar" };
  }
}

export async function deleteAvatar(
  db: DrizzleDb,
  supabase: SupabaseClient,
  userId: string,
): Promise<ActionResult<null>> {
  const [profile] = await db
    .select({ avatarUrl: profiles.avatarUrl })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  try {
    if (profile?.avatarUrl) {
      await deleteAvatarFromStorage(supabase, profile.avatarUrl);
    }
    const { error: authError } = await supabase.auth.updateUser({
      data: { avatar_url: null },
    });
    if (authError) return { success: false, error: authError.message };
    await db
      .update(profiles)
      .set({ avatarUrl: null, updatedAt: new Date() })
      .where(eq(profiles.id, userId));
    return { success: true, data: null };
  } catch (error) {
    logger.error("Failed to delete avatar", { error, userId });
    return { success: false, error: "Failed to delete avatar" };
  }
}

export async function deleteAccount(
  db: DrizzleDb,
  supabase: SupabaseClient,
  userId: string,
): Promise<ActionResult<null>> {
  const adminClient = await createAdminClient();
  try {
    // Read the avatar URL before removing the row so storage cleanup can run
    // against the last known avatar.
    const [profile] = await db
      .select({ avatarUrl: profiles.avatarUrl })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    // RLS parity: own-account deletion, gated by requireAuth at the caller.
    try {
      await db.delete(profiles).where(eq(profiles.id, userId));
    } catch (cause) {
      return {
        success: false,
        error: `Failed to delete profile: ${
          cause instanceof Error ? cause.message : "Database error"
        }`,
      };
    }

    if (profile?.avatarUrl) {
      await deleteAvatarFromStorage(supabase, profile.avatarUrl);
    }

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
