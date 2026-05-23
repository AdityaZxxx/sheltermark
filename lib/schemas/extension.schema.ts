import { z } from "zod";

import { uuidSchema } from "~/lib/schemas/common";
import { tagNameSchema } from "~/lib/schemas/tag.schema";

const extensionBookmarkTitleSchema = z
  .string()
  .min(1, "Title is required")
  .max(200, "Title too long");

/**
 * Request body for POST /api/extension/bookmark.
 *
 * Backward compatible: older extension builds send only `url` (+ optional
 * snake_case `workspace_id` and `title`). `tags` carries tag *names* (not
 * ids) so a queue payload is self-contained offline — names resolve against
 * current tag state at apply time on the server.
 */
export const extensionBookmarkCreateSchema = z.object({
  url: z.url("Invalid URL format"),
  workspace_id: uuidSchema.nullish(),
  title: extensionBookmarkTitleSchema.nullish(),
});

/** Same as create, but with the optional metadata edit fields present. */
export const extensionBookmarkSaveSchema = extensionBookmarkCreateSchema.extend(
  {
    tags: z.array(tagNameSchema).max(50, "Too many tags").optional(),
  },
);

export type ExtensionBookmarkCreateInput = z.infer<
  typeof extensionBookmarkCreateSchema
>;
export type ExtensionBookmarkSaveInput = z.infer<
  typeof extensionBookmarkSaveSchema
>;
