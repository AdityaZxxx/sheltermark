/**
 * Folder-path filtering for Netscape browser imports.
 *
 * Folders are represented as ordered arrays of breadcrumb segments,
 * e.g. `["Bookmarks bar", "Programming", "React"]`. To compare and
 * transport folder paths we join them with the NUL character, which
 * cannot appear in folder names.
 *
 * The selection rule is "include every bookmark whose folder path is
 * either empty or whose every ancestor is selected". This mirrors the
 * recursive tree-selection UX in the preview step.
 *
 * An empty `selected` set is treated as "all selected" — this is the
 * default state (ADR-0005).
 */

export const FOLDER_PATH_SEPARATOR = "\u0000";

/**
 * A folder entry surfaced in the browser-import preview. Folders are
 * derived from the parsed bookmarks' `folderPath` arrays.
 */
export interface FolderNode {
  /** Full path segments, e.g. ["Bookmarks bar", "Programming", "React"]. */
  path: string[];
  /** Direct bookmarks that live at this exact folder (not in children). */
  directCount: number;
  /** Total bookmarks in this folder and all descendants. */
  totalCount: number;
}

export function pathKey(path: readonly string[]): string {
  return path.join(FOLDER_PATH_SEPARATOR);
}

/**
 * Decide whether a single bookmark survives a folder filter.
 *
 * Every ancestor folder of the bookmark (and the bookmark's own folder)
 * must be present in `selected`. Top-level bookmarks (no `folderPath`)
 * are kept only if the empty path key (`""`) is in `selected`.
 */
export function bookmarkSurvivesFilter(
  folderPath: readonly string[] | undefined,
  selected: ReadonlySet<string>,
): boolean {
  if (!folderPath || folderPath.length === 0) {
    return selected.has("");
  }
  for (let depth = 1; depth <= folderPath.length; depth++) {
    const ancestor = folderPath.slice(0, depth);
    if (!selected.has(pathKey(ancestor))) return false;
  }
  return true;
}

/**
 * Filter an array of bookmarks (with optional `folderPath`) to those
 * surviving a folder filter.
 */
export function filterByFolders<
  T extends { folderPath?: readonly string[] | string[] },
>(bookmarks: readonly T[], selected: ReadonlySet<string>): T[] {
  return bookmarks.filter((bm) =>
    bookmarkSurvivesFilter(bm.folderPath, selected),
  );
}
