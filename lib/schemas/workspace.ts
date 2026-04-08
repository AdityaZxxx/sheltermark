import { z } from "zod";

const uuidSchema = z.string().uuid();

const timestampSchema = z.string().datetime();

export const workspaceSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  name: z.string().min(1),
  is_public: z.boolean().default(false),
  is_default: z.boolean(),
  auto_check_broken: z.boolean().default(true),
  created_at: timestampSchema,
  updated_at: timestampSchema.nullable(),
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

export const workspaceSetDefaultSchema = z.object({
  id: uuidSchema,
});

export type WorkspaceWithCount = Workspace & {
  bookmarks_count: number;
};

export type Workspace = z.infer<typeof workspaceSchema>;
export type WorkspaceCreateInput = z.infer<typeof workspaceCreateSchema>;
export type WorkspaceRenameInput = z.infer<typeof workspaceRenameSchema>;
export type WorkspaceSetDefaultInput = z.infer<
  typeof workspaceSetDefaultSchema
>;
