import { z } from "zod";

import { profiles } from "~/lib/data/schema";
import { uuidSchema } from "~/lib/schemas/common";

export const usernameSchema = z
  .string()
  .min(3, { message: "Username must be at least 3 characters" })
  .max(30, { message: "Username too long" })
  .refine((val) => !val || /^[a-z0-9_]+$/.test(val), {
    message:
      "Username must only contain lowercase letters, numbers, and underscores",
  });

const socialUsernameSchema = z
  .string()
  .regex(/^[a-zA-Z0-9_-]+$/, "Invalid username")
  .optional()
  .or(z.literal(""));

const websiteSchema = z
  .string()
  .refine(
    (val) => {
      try {
        const parsed = new URL(val.startsWith("http") ? val : `https://${val}`);
        return parsed instanceof URL;
      } catch {
        return false;
      }
    },
    { message: "Invalid website domain" },
  )
  .optional()
  .or(z.literal(""));

export const TRASH_CLEANUP_INTERVALS = [7, 30] as const;

export const updatePublicProfileSchema = z.object({
  username: usernameSchema,
  is_public: z.boolean(),
  bio: z
    .string()
    .max(160, "Bio must be less than 160 characters")
    .optional()
    .or(z.literal(""))
    .nullable(),
  github_username: socialUsernameSchema.nullable(),
  x_username: socialUsernameSchema.nullable(),
  website: websiteSchema.nullable(),
  current_username: z.string().optional(),
});

export const getProfileByUsernameSchema = z.object({
  username: usernameSchema,
});

export const updateProfileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  trash_cleanup_interval: z.number().int().optional(),
});

export const exportOptionsSchema = z.object({
  workspaceId: uuidSchema.nullable().optional(),
  format: z.enum(["json", "csv"]),
});

export const importOptionsSchema = z.object({
  targetWorkspaceId: uuidSchema.nullable().optional(),
  duplicateStrategy: z.enum(["skip", "replace"]),
  createWorkspace: z.boolean().optional(),
  newWorkspaceName: z.string().min(1).max(35).optional(),
  /**
   * Optional folder-path filter for browser (Netscape) imports. Each entry
   * is a folder breadcrumb joined by NUL (`\u0000`). When provided, only
   * bookmarks whose `folderPath` matches an allowed entry (or has an
   * ancestor matching one) are imported. Empty/undefined = no filter.
   * See ADR-0005.
   */
  folderPaths: z.array(z.string()).optional(),
});

export type Profile = typeof profiles.$inferSelect;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdatePublicProfileInput = z.infer<
  typeof updatePublicProfileSchema
>;
export type ImportOptionsInput = z.infer<typeof importOptionsSchema>;
