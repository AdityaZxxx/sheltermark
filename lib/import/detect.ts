/**
 * Format detection for import files.
 *
 * Detection is content-based, not filename-based — files can be named
 * anything. The detector performs minimal magic-signature routing only;
 * structural validity is the parser's job.
 */

export type DetectedFormat = "json" | "csv" | "netscape" | "unknown";

const NETSCAPE_MAGIC = "NETSCAPE-Bookmark-file-1";

/**
 * Detect the format of an import file by inspecting its content.
 *
 * - JSON: starts with `{` or `[` after trimming
 * - CSV: first non-empty line contains a comma and the second line looks like data
 * - Netscape: contains the `NETSCAPE-Bookmark-file-1` marker in the first 1KB
 * - Unknown: anything else
 */
export function detectFormat(content: string): DetectedFormat {
  const trimmed = content.trimStart();

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return "json";
  }

  // Check Netscape magic signature in the first 1KB.
  // The DOCTYPE may be before or after the magic comment; some exporters
  // omit the DOCTYPE entirely.
  const head = content.slice(0, 1024);
  if (head.includes(NETSCAPE_MAGIC)) {
    return "netscape";
  }

  // CSV heuristic: first non-empty line has at least one comma, and there
  // is at least one more non-empty line. We don't validate the structure
  // here — that's the parser's job.
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length >= 2) {
    const first = lines[0] ?? "";
    if (first.includes(",")) {
      return "csv";
    }
  }

  return "unknown";
}

/**
 * Human-readable format name for UI display.
 */
export function formatDisplayName(format: DetectedFormat): string {
  switch (format) {
    case "json":
      return "Sheltermark JSON";
    case "csv":
      return "Sheltermark CSV";
    case "netscape":
      return "Browser bookmarks (HTML)";
    case "unknown":
      return "Unknown format";
  }
}
