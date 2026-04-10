import { z } from "zod";

const uuidSchema = z.uuid();

const timestampSchema = z.iso.datetime();

export const bookmarkSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  workspace_id: uuidSchema.nullable(),
  url: z.url(),
  title: z.string(),
  favicon_url: z.url().nullable(),
  og_image_url: z.url().nullable(),
  is_public: z.boolean().default(false),
  is_broken: z.boolean().default(false),
  last_checked_at: timestampSchema.nullable(),
  http_status: z.number().int().nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema.nullable(),
});

export const bookmarkCreateSchema = z.object({
  url: z.url("Invalid URL format"),
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
  updated_at: z.string().nullable(),
});

export const workspaceWithBookmarksSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1),
  bookmarks: z.array(bookmarkPreviewSchema),
});

export type Bookmark = z.infer<typeof bookmarkSchema>;
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
