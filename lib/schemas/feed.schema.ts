import { z } from "zod";
import { timestampSchema, uuidSchema } from "~/lib/schemas/common";

const feedSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  workspace_id: uuidSchema.nullable(),
  url: z.url(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  site_url: z.string().nullable(),
  icon_url: z.string().nullable(),
  last_synced_at: timestampSchema.nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema.nullable(),
});

export const feedCreateSchema = z.object({
  url: z
    .url("Please enter a valid URL")
    .refine(
      (url) => url.includes(".") || url.includes("localhost"),
      "Please enter a valid feed URL",
    ),
  workspaceId: uuidSchema.optional().nullable(),
});

export const feedRefreshSchema = z.object({
  id: uuidSchema,
});

export const feedDeleteSchema = z.object({
  id: uuidSchema,
});

export type Feed = z.infer<typeof feedSchema>;
