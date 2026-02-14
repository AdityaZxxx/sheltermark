import { z } from "zod";

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
  .regex(
    /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
    "Invalid website domain",
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

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdatePublicProfileInput = z.infer<
  typeof updatePublicProfileSchema
>;
