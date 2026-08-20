import { z } from "zod";

import { timestampSchema, uuidSchema } from "~/lib/schemas/common";

export const tagNameSchema = z
  .string()
  .min(1, "Tag name is required")
  .max(50, "Tag name too long")
  .trim();

const tagSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  name: tagNameSchema,
  created_at: timestampSchema,
});

const tagWithCountSchema = tagSchema.extend({
  count: z.number().int().nonnegative(),
});

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

export type Tag = z.infer<typeof tagSchema>;
export type TagWithCount = z.infer<typeof tagWithCountSchema>;
export type GetBookmarkTagsInput = z.infer<typeof getBookmarkTagsSchema>;
export type RenameTagInput = z.infer<typeof renameTagSchema>;
export type DeleteTagInput = z.infer<typeof deleteTagSchema>;
