import { z } from "zod";

import type { workspaces } from "~/lib/data/schema";
import type { Bookmark } from "~/lib/schemas/bookmark.schema";

import { uuidSchema } from "~/lib/schemas/common";

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

export type Workspace = typeof workspaces.$inferSelect;
