/**
 * Netscape Bookmark File parser.
 *
 * Parses the `bookmarks.html` format exported by Chrome, Firefox, Edge,
 * and Safari into `ParsedBookmark[]`. Folder hierarchy is preserved as
 * `folderPath: string[]` on each candidate — this field is used for
 * preview filtering only and is never persisted (see ADR-0005).
 *
 * Structural browser artifacts that don't represent bookmarks are
 * silently skipped:
 *   - `<H3>` folder markers (no URL of their own)
 *   - `<HR>` separators
 *   - `<DT>` entries that contain neither `<A>` nor folder children
 *
 * The parser uses `parse5` (WHATWG-compliant HTML5 parser) so it
 * tolerates malformed exports gracefully.
 */

import type { DefaultTreeAdapterMap } from "parse5";

import { parseFragment } from "parse5";

import type { ParsedBookmark, ParseResult } from "./parsers";

type ChildNode = DefaultTreeAdapterMap["childNode"];
type ParentNode = DefaultTreeAdapterMap["parentNode"];
type Element = DefaultTreeAdapterMap["element"];
type TextNode = DefaultTreeAdapterMap["textNode"];
type Node = DefaultTreeAdapterMap["node"];

function isTextNode(node: ChildNode): node is TextNode {
  return node.nodeName === "#text";
}

/** Schemes we refuse to import. Matches the metadata pipeline's safety policy. */
const REJECTED_SCHEMES = new Set([
  "javascript:",
  "data:",
  "file:",
  "vbscript:",
  "about:",
]);

/**
 * Maximum size of an embedded favicon data URL we'll keep on the
 * bookmark. Real-world browser exports can embed multi-MB PNG data URLs
 * for high-res favicons; persisting those bloats the DB. 64KB covers
 * essentially all real favicons.
 */
const MAX_FAVICON_DATA_URL_LENGTH = 64 * 1024;

/** Strip HTML entities that show up in titles (`&`, `"`, etc.). */
function decodeEntities(text: string): string {
  return text
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number.parseInt(code, 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : _;
    });
}

/** Collect all text content from an element, concatenated. */
function extractText(element: Element): string {
  const parts: string[] = [];
  const walk = (node: ChildNode): void => {
    if (isTextNode(node)) {
      parts.push(node.value);
    } else if ("childNodes" in node && node.childNodes) {
      for (const child of node.childNodes) {
        walk(child);
      }
    }
  };
  for (const child of element.childNodes) {
    walk(child);
  }
  return decodeEntities(parts.join("").trim());
}

/** Get an attribute value by name, or undefined if missing. */
function getAttr(element: Element, name: string): string | undefined {
  const attr = element.attrs.find(
    (a: { name: string; value: string }) => a.name === name,
  );
  return attr?.value;
}

/** Is this node an `<a>` element? Case-insensitive (parse5 lowercases tag names). */
function isAnchor(node: Node): node is Element {
  return node.nodeName === "a";
}

function isHR(node: Node): boolean {
  return node.nodeName === "hr";
}

function isH3(node: Node): boolean {
  return node.nodeName === "h3";
}

function isDL(node: Node): node is Element {
  return node.nodeName === "dl";
}

function isP(node: Node): boolean {
  return node.nodeName === "p";
}

/**
 * Walk a `<DL>` subtree and emit bookmarks. Folder hierarchy is tracked
 * via `currentPath`, which is mutated as we descend and ascend.
 */
function walkDL(
  dl: Element,
  currentPath: string[],
  out: ParsedBookmark[],
): void {
  for (const child of dl.childNodes) {
    if (!("tagName" in child)) continue; // skip text/comments
    if (isP(child)) continue; // <p> is a Netscape-formatting artifact

    if (child.nodeName !== "dt") continue; // only <DT> entries carry content

    // Each <DT> can contain:
    //   - <H3> + <DL>: a folder (descend)
    //   - <A>: a bookmark
    //   - <HR>: a separator (skip)
    //   - nested <DL> directly (folder with no H3 label)
    let folderH3: Element | null = null;
    let folderDL: Element | null = null;
    let anchor: Element | null = null;

    for (const dtChild of child.childNodes) {
      if (!("tagName" in dtChild)) continue;
      if (isH3(dtChild)) {
        folderH3 = dtChild;
      } else if (isDL(dtChild)) {
        folderDL = dtChild;
      } else if (isAnchor(dtChild)) {
        anchor = dtChild;
      } else if (isHR(dtChild)) {
        // separator — skip
      }
    }

    if (anchor) {
      const bm = anchorToBookmark(anchor, currentPath);
      if (bm) out.push(bm);
    }

    if (folderDL) {
      const folderName = folderH3 ? extractText(folderH3) : "";
      const nextPath = folderName ? [...currentPath, folderName] : currentPath;
      walkDL(folderDL, nextPath, out);
    }
  }
}

/** Convert an `<A>` element to a ParsedBookmark, or null if rejected. */
function anchorToBookmark(
  anchor: Element,
  folderPath: string[],
): ParsedBookmark | null {
  const rawHref = getAttr(anchor, "href");
  if (!rawHref) return null;

  let url: string;
  try {
    url = new URL(rawHref).toString();
  } catch {
    return null;
  }

  // Reject unsafe schemes — same policy as the metadata pipeline.
  const scheme = url.split(":", 1)[0]?.toLowerCase() ?? "";
  if (REJECTED_SCHEMES.has(`${scheme}:`)) return null;

  const title = extractText(anchor);

  const iconAttr = getAttr(anchor, "icon");
  let favicon_url: string | undefined;
  if (iconAttr?.startsWith("data:")) {
    // data: favicons above the size cap are likely clipped exports;
    // skipping falls back to favicon-resolution strategies.
    if (iconAttr.length <= MAX_FAVICON_DATA_URL_LENGTH) {
      favicon_url = iconAttr;
    }
  } else if (iconAttr) {
    favicon_url = iconAttr;
  }

  // Some exports put favicon in ICON_DATA; same handling.
  if (!favicon_url) {
    const iconData = getAttr(anchor, "icon_data");
    if (iconData?.startsWith("data:")) {
      if (iconData.length <= MAX_FAVICON_DATA_URL_LENGTH) {
        favicon_url = iconData;
      }
    }
  }

  return {
    url,
    title,
    favicon_url,
    folderPath: folderPath.length > 0 ? folderPath : undefined,
  };
}

/**
 * Parse the contents of a Netscape bookmarks.html file.
 *
 * Returns an empty array (not an error) if the file parses but contains
 * no bookmarks. Returns an error only on truly malformed input where the
 * parser itself cannot produce a tree.
 */
export function parseNetscapeHTML(content: string): ParseResult {
  if (!content.includes("NETSCAPE-Bookmark-file-1")) {
    return {
      success: false,
      error:
        "File does not appear to be a Netscape bookmark export (missing NETSCAPE-Bookmark-file-1 marker).",
    };
  }

  let document: ParentNode;
  try {
    document = parseFragment(content);
  } catch {
    return { success: false, error: "Failed to parse HTML" };
  }

  const bookmarks: ParsedBookmark[] = [];

  for (const node of document.childNodes) {
    if (!("tagName" in node)) continue;
    if (isDL(node)) {
      walkDL(node, [], bookmarks);
    }
  }

  if (bookmarks.length === 0) {
    return {
      success: false,
      error: "No bookmarks found in file (only folders or separators).",
    };
  }

  return { success: true, bookmarks };
}
