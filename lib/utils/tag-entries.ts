import type { Tag, TagWithCount } from "~/lib/schemas/tag.schema";

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

export function filterTagSuggestions(
  tags: TagWithCount[],
  entries: TagEntry[],
  query: string,
): TagWithCount[] {
  const usedIds = new Set(entries.map((e) => e.id).filter(Boolean));
  const usedNames = new Set(entries.map((e) => e.name.toLowerCase()));
  const q = query.trim().toLowerCase();
  return tags.filter((t) => {
    if (usedIds.has(t.id)) return false;
    if (usedNames.has(t.name.toLowerCase())) return false;
    if (!q) return true;
    return t.name.toLowerCase().includes(q);
  });
}

export type TagKeyAction = "none" | "up" | "down" | "activate" | "commit";

export function tagKeyAction(
  key: string,
  activeIndex: number,
  optionCount: number,
): TagKeyAction {
  switch (key) {
    case "ArrowDown":
      return activeIndex < optionCount - 1 ? "down" : "none";
    case "ArrowUp":
      return activeIndex > -1 ? "up" : "none";
    case "Enter":
      return activeIndex > -1 && activeIndex < optionCount
        ? "activate"
        : "commit";
    default:
      return "none";
  }
}

export const MAX_AI_SUGGESTIONS = 5;

/**
 * Merges AI-suggested tag names into the current draft entries. Case-
 * insensitive dedupe against existing entries; a candidate matching one of
 * the user's tags by name reuses that tag identity (id + canonical casing),
 * otherwise it becomes a name-only draft entry. Existing order is preserved,
 * new candidates append. Used for both single-apply (one candidate) and
 * apply-all.
 */
export function mergeSuggestedTags(
  current: TagEntry[],
  candidates: string[],
  userTags: Tag[],
): TagEntry[] {
  const normalized = candidates
    .map((c) => c.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .slice(0, MAX_AI_SUGGESTIONS);

  const result = [...current];
  const seen = new Set(result.map((e) => e.name.toLowerCase()));
  for (const candidate of normalized) {
    const key = candidate.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const existing = userTags.find((t) => t.name.toLowerCase() === key);
    result.push(
      existing ? { id: existing.id, name: existing.name } : { name: candidate },
    );
  }
  return result;
}
