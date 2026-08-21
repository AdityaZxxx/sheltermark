import { z } from "zod";

import type { feeds } from "~/lib/data/schema";

import { uuidSchema } from "~/lib/schemas/common";

export const feedCreateSchema = z.object({
  url: z
    .url("Please enter a valid URL")
    .refine(
      (url) => url.includes(".") || url.includes("localhost"),
      "Please enter a valid feed URL",
    ),
  workspaceId: uuidSchema.optional().nullable(),
});

export const feedRefreshSchema = z.object({
  id: uuidSchema,
});

export const feedDeleteSchema = z.object({
  id: uuidSchema,
});

export type Feed = typeof feeds.$inferSelect;
