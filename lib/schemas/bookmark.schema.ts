import { z } from "zod";

import type { bookmarks } from "~/lib/data/schema";

import { uuidSchema } from "~/lib/schemas/common";

const bookmarkCreateSchema = z.object({
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

export const bookmarkUpdateNoteSchema = z.object({
  id: uuidSchema,
  note: z.string().max(2000, "Note too long").nullable(),
});

export const bookmarkRefetchMetadataSchema = z.object({
  id: uuidSchema,
});

export const generateAiTitleSchema = z.object({
  bookmarkId: uuidSchema,
});

export const interpretSearchQuerySchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, "Query is required")
    .max(200, "Query too long"),
});

export const bookmarkEditSchema = z.object({
  id: uuidSchema,
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  note: z.string().max(2000, "Note too long").nullable(),
  tags: z
    .array(
      z.object({
        id: uuidSchema.optional(),
        name: z.string().min(1).max(50).optional(),
      }),
    )
    .max(50, "Too many tags"),
});

const workspaceNameSchema = z
  .string()
  .min(1, "Workspace name is required")
  .max(35, "Workspace name too long");

export const bookmarkRestoreSchema = z.object({
  ids: z.array(uuidSchema).min(1, "At least one bookmark ID required"),
  targetWorkspaceId: uuidSchema.nullable().optional(),
  newWorkspaceName: workspaceNameSchema.optional(),
});

const bookmarkPreviewSchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string().nullable(),
  favicon_url: z.string().nullable(),
  og_image_url: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
});

export type BookmarkPreview = z.infer<typeof bookmarkPreviewSchema>;

const workspaceWithBookmarksSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1),
  bookmarks: z.array(bookmarkPreviewSchema),
});

export type Bookmark = typeof bookmarks.$inferSelect;
export type BookmarkCreateInput = z.infer<typeof bookmarkCreateSchema>;
export type BookmarkDeleteInput = z.infer<typeof bookmarkDeleteSchema>;
export type BookmarkRestoreInput = z.infer<typeof bookmarkRestoreSchema>;
export type BookmarkMoveInput = z.infer<typeof bookmarkMoveSchema>;
export type BookmarkRenameInput = z.infer<typeof bookmarkRenameSchema>;
export type BookmarkUpdateNoteInput = z.infer<typeof bookmarkUpdateNoteSchema>;
export type BookmarkRefetchMetadataInput = z.infer<
  typeof bookmarkRefetchMetadataSchema
>;
export type BookmarkEditInput = z.infer<typeof bookmarkEditSchema>;
export type GenerateAiTitleInput = z.infer<typeof generateAiTitleSchema>;
export type InterpretSearchQueryInput = z.infer<
  typeof interpretSearchQuerySchema
>;
export type WorkspaceWithBookmarks = z.infer<
  typeof workspaceWithBookmarksSchema
>;

const bookmarkSortSchemaBase = z.object({
  sortBy: z
    .enum(["created_at", "updated_at", "title", "domain"])
    .default("updated_at"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type BookmarkSortBy = z.infer<typeof bookmarkSortSchemaBase>["sortBy"];
export type BookmarkSort = z.infer<typeof bookmarkSortSchemaBase>;
