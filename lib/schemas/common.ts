import { z } from "zod";

/**
 * Shared schema primitives for the entire codebase.
 * Import these instead of redefining in each domain schema.
 */

export const uuidSchema = z.uuid();

export const timestampSchema = z.iso.datetime();

export const urlSchema = z.string().url();

/**
 * Slug: lowercase alphanumeric + hyphens, no leading/trailing hyphens
 */
export const slugSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug format");
