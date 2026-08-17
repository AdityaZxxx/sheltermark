import { z } from "zod";

import type { Bookmark } from "~/lib/schemas/bookmark.schema";

import { timestampSchema, uuidSchema } from "~/lib/schemas/common";

const workspaceSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  name: z.string().min(1),
  is_public: z.boolean().default(false),
  is_default: z.boolean(),
  auto_check_broken: z.boolean().default(true),
  created_at: timestampSchema,
  updated_at: timestampSchema.nullable(),
  deleted_at: timestampSchema.nullable(),
});

export const workspaceCreateSchema = z.object({
  name: z
    .string()
    .min(1, "Workspace name is required")
    .max(35, "Workspace name too long"),
});

export const workspaceRenameSchema = z.object({
  id: uuidSchema,
  name: z
    .string()
    .min(1, "Workspace name is required")
    .max(35, "Workspace name too long"),
});

export type WorkspaceWithCount = Workspace & {
  bookmarks_count: number;
};

export type TrashedWorkspace = Workspace & {
  bookmarks_count: number;
  bookmarks: Bookmark[];
};

export type Workspace = z.infer<typeof workspaceSchema>;
