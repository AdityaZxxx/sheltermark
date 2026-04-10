import { z } from "zod";

const uuidSchema = z.uuid();

const timestampSchema = z.iso.datetime();

export const usernameSchema = z
  .string()
  .min(3, { message: "Username must be at least 3 characters" })
  .max(30, { message: "Username too long" })
  .refine((val) => !val || /^[a-z0-9_]+$/.test(val), {
    message:
      "Username must only contain lowercase letters, numbers, and underscores",
  });

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

export const profileSchema = z.object({
  id: uuidSchema,
  username: usernameSchema,
  name: z.string().nullable(),
  avatar_url: z.url().nullable(),
  bio: z
    .string()
    .max(160, "Bio must be less than 160 characters")
    .optional()
    .or(z.literal("")),
  website_url: websiteSchema.nullable(),
  github_url: z.url().nullable(),
  x_url: z.url().nullable(),
  is_public: z.boolean(),
  created_at: timestampSchema,
  updated_at: timestampSchema.nullable(),
});

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
});

export const importPreviewSchema = z.object({
  totalBookmarks: z.number(),
  validBookmarks: z.number(),
  duplicates: z.number(),
  workspaces: z.array(
    z.object({
      name: z.string(),
      count: z.number(),
    }),
  ),
});

export type Profile = z.infer<typeof profileSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdatePublicProfileInput = z.infer<
  typeof updatePublicProfileSchema
>;
export type ExportOptionsInput = z.infer<typeof exportOptionsSchema>;
export type ImportOptionsInput = z.infer<typeof importOptionsSchema>;
export type ImportPreviewOutput = z.infer<typeof importPreviewSchema>;
