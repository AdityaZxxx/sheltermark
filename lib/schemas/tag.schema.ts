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

export const addTagToBookmarkSchema = z.object({
  bookmarkId: uuidSchema,
  tagId: uuidSchema.optional(),
  name: tagNameSchema.optional(),
});

export const removeTagFromBookmarkSchema = z.object({
  bookmarkId: uuidSchema,
  tagId: uuidSchema,
});

export const setBookmarkTagsSchema = z.object({
  bookmarkId: uuidSchema,
  tags: z
    .array(
      z.object({
        id: uuidSchema.optional(),
        name: tagNameSchema.optional(),
      }),
    )
    .max(50, "Too many tags"),
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
export type AddTagToBookmarkInput = z.infer<typeof addTagToBookmarkSchema>;
export type RemoveTagFromBookmarkInput = z.infer<
  typeof removeTagFromBookmarkSchema
>;
export type SetBookmarkTagsInput = z.infer<typeof setBookmarkTagsSchema>;
export type SetBookmarkTagEntry = z.infer<
  typeof setBookmarkTagsSchema
>["tags"][number];
export type GetBookmarkTagsInput = z.infer<typeof getBookmarkTagsSchema>;
export type RenameTagInput = z.infer<typeof renameTagSchema>;
export type DeleteTagInput = z.infer<typeof deleteTagSchema>;
