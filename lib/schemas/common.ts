import { z } from "zod";

/**
 * Shared schema primitives for the entire codebase.
 * Import these instead of redefining in each domain schema.
 */

export const uuidSchema = z.uuid();

export const urlSchema = z.url();

/**
 * Slug: lowercase alphanumeric + hyphens, no leading/trailing hyphens
 */
export const slugSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug format");

export type BookmarkViewVariant = "list" | "card" | "comfort";
export const bookmarkViewVariantSchema = z.enum(["list", "card", "comfort"]);

export type BookmarkScope =
  | { type: "global" }
  | { type: "workspace"; id: string };
