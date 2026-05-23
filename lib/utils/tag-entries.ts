import type { Tag } from "~/lib/schemas/tag.schema";

export type TagEntry = { id?: string; name: string };

export function tagsToEntries(tags: Tag[]): TagEntry[] {
  return tags.map((t) => ({ id: t.id, name: t.name }));
}

export function entriesEqual(a: TagEntry[], b: TagEntry[]): boolean {
  if (a.length !== b.length) return false;
  const aKeys = a.map((e) => e.id ?? `name:${e.name.toLowerCase()}`).toSorted();
  const bKeys = b.map((e) => e.id ?? `name:${e.name.toLowerCase()}`).toSorted();
  return aKeys.every((k, i) => k === bKeys[i]);
}
