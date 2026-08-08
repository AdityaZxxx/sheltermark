/**
 * Format a count with its noun, pluralized with a plain "s".
 * Use only when the noun pluralizes with "s"; irregular nouns
 * need their own copy.
 *
 * formatCount(1, "tag")  // "1 tag"
 * formatCount(3, "use")  // "3 uses"
 */
export function formatCount(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
