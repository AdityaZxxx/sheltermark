import { z } from "zod";

import type { tags } from "~/lib/data/schema";

import { uuidSchema } from "~/lib/schemas/common";

export const tagNameSchema = z
  .string()
  .min(1, "Tag name is required")
  .max(50, "Tag name too long")
  .trim();

export const getBookmarkTagsSchema = z.object({
  bookmarkId: uuidSchema,
});

export const renameTagSchema = z.object({
  tagId: uuidSchema,
  name: tagNameSchema,
});

export const deleteTagSchema = z.object({
  tagId: uuidSchema,
});

export type Tag = typeof tags.$inferSelect;
export type TagWithCount = Tag & { count: number };
export type GetBookmarkTagsInput = z.infer<typeof getBookmarkTagsSchema>;
export type RenameTagInput = z.infer<typeof renameTagSchema>;
export type DeleteTagInput = z.infer<typeof deleteTagSchema>;
