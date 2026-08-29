// Reader appearance prefs (ADR-0007): one definition shared by the preview
// panel (state, localStorage) and the server route (query-param validation).
// Pure and DOM-free on the parse path; the localStorage accessor is guarded
// by callers running client-side.
import { z } from "zod";

export const readerPrefsSchema = z.object({
  theme: z.enum(["light", "dark"]),
  font: z.enum(["sans", "serif"]),
  size: z.enum(["sm", "md", "lg"]),
});

export type ReaderPrefs = z.infer<typeof readerPrefsSchema>;

export const READER_DEFAULT: ReaderPrefs = {
  theme: "light",
  font: "sans",
  size: "md",
};

export const READER_KEY = "sheltermark.reader";

const storedReaderSchema = z.object({
  theme: z.enum(["light", "dark"]).catch(READER_DEFAULT.theme),
  font: z.enum(["sans", "serif"]).catch(READER_DEFAULT.font),
  size: z.enum(["sm", "md", "lg"]).catch(READER_DEFAULT.size),
});

// Unknown/corrupt localStorage values fall back to defaults via .catch().
export function parseStoredReaderPrefs(raw: string | null): ReaderPrefs {
  if (!raw) return READER_DEFAULT;
  try {
    return storedReaderSchema.parse(JSON.parse(raw));
  } catch {
    return READER_DEFAULT;
  }
}

export function cycleTextSize(size: ReaderPrefs["size"]): ReaderPrefs["size"] {
  return size === "sm" ? "md" : size === "md" ? "lg" : "sm";
}
