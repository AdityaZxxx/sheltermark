import { z } from "zod";

export const bookmarkCreateSchema = z.object({
  url: z.url("Invalid URL format"),
  workspaceId: z.uuid().nullable().optional(),
});

export const bookmarkDeleteSchema = z.object({
  ids: z.array(z.uuid()).min(1, "At least one bookmark ID required"),
});

export const bookmarkMoveSchema = z.object({
  ids: z.array(z.uuid()).min(1, "At least one bookmark ID required"),
  targetWorkspaceId: z.uuid().nullable(),
});

export const bookmarkRenameSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
});

export const workspaceCreateSchema = z.object({
  name: z
    .string()
    .min(1, "Workspace name is required")
    .max(50, "Name too long"),
});

export const workspaceRenameSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1, "Name is required").max(50, "Name too long"),
});

export const workspaceSetDefaultSchema = z.object({
  id: z.uuid(),
});

export const usernameSchema = z
  .string()
  .min(3, { message: "Username must be at least 3 characters" })
  .max(30, { message: "Username too long" })
  .refine((val) => !val || /^[a-z0-9_]+$/.test(val), {
    message:
      "Username must only contain lowercase letters, numbers, and underscores",
  });

export const bioSchema = z
  .string()
  .max(160, "Bio must be less than 160 characters")
  .optional()
  .or(z.literal(""));

export const socialUsernameSchema = z
  .string()
  .regex(/^[a-zA-Z0-9_-]+$/, "Invalid username")
  .optional()
  .or(z.literal(""));

export const websiteSchema = z
  .string()
  .refine(
    (val) => {
      try {
        new URL(val.startsWith("http") ? val : `https://${val}`);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Invalid website domain" },
  )
  .optional()
  .or(z.literal(""));

export const updateProfileSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
});

export const updatePublicProfileSchema = z.object({
  username: usernameSchema,
  is_public: z.boolean(),
  bio: bioSchema,
  github_username: socialUsernameSchema,
  x_username: socialUsernameSchema,
  website: websiteSchema,
  current_username: z.string().optional(),
});

export type BookmarkCreateInput = z.infer<typeof bookmarkCreateSchema>;
export type BookmarkDeleteInput = z.infer<typeof bookmarkDeleteSchema>;
export type BookmarkMoveInput = z.infer<typeof bookmarkMoveSchema>;
export type BookmarkRenameInput = z.infer<typeof bookmarkRenameSchema>;
export type WorkspaceCreateInput = z.infer<typeof workspaceCreateSchema>;
export type WorkspaceRenameInput = z.infer<typeof workspaceRenameSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdatePublicProfileInput = z.infer<
  typeof updatePublicProfileSchema
>;
