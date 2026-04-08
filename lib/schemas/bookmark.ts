import { z } from "zod";

const uuidSchema = z.string().uuid();

const timestampSchema = z.string().datetime();

export const bookmarkSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  workspace_id: uuidSchema.nullable(),
  url: z.string().url(),
  title: z.string(),
  favicon_url: z.string().url().nullable(),
  og_image_url: z.string().url().nullable(),
  is_public: z.boolean().default(false),
  is_broken: z.boolean().default(false),
  last_checked_at: timestampSchema.nullable(),
  http_status: z.number().int().nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema.nullable(),
});

export const bookmarkCreateSchema = z.object({
  url: z.string().url("Invalid URL format"),
  workspaceId: uuidSchema,
});

export const bookmarkDeleteSchema = z.object({
  ids: z.array(uuidSchema).min(1, "At least one bookmark ID required"),
});

export const bookmarkMoveSchema = z.object({
  ids: z.array(uuidSchema).min(1, "At least one bookmark ID required"),
  targetWorkspaceId: uuidSchema,
});

export const bookmarkRenameSchema = z.object({
  id: uuidSchema,
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
});

export const bookmarkRefetchMetadataSchema = z.object({
  id: uuidSchema,
});

export const bookmarkPreviewSchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string().nullable(),
  favicon_url: z.string().nullable(),
  og_image_url: z.string().nullable(),
  created_at: z.string(),
});

export const workspaceWithBookmarksSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1),
  bookmarks: z.array(bookmarkPreviewSchema),
});

export type Bookmark = z.infer<typeof bookmarkSchema>;
export type BookmarkPreview = z.infer<typeof bookmarkPreviewSchema>;
export type BookmarkCreateInput = z.infer<typeof bookmarkCreateSchema>;
export type BookmarkDeleteInput = z.infer<typeof bookmarkDeleteSchema>;
export type BookmarkMoveInput = z.infer<typeof bookmarkMoveSchema>;
export type BookmarkRenameInput = z.infer<typeof bookmarkRenameSchema>;
export type BookmarkRefetchMetadataInput = z.infer<
  typeof bookmarkRefetchMetadataSchema
>;
export type WorkspaceWithBookmarks = z.infer<
  typeof workspaceWithBookmarksSchema
>;
