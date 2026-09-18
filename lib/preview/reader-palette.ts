// Reader palette (ADR-0007): exact app surface tokens per reader theme.
// Native render and the isolated iframe share these; values mirror
// app/globals.css — update together.
import type { ReaderPrefs } from "./reader-prefs";

interface ReaderPalette {
  fg: string;
  bg: string;
  muted: string;
  quote: string;
  preBg: string;
  link: string;
}

export function readerPalette(theme: ReaderPrefs["theme"]): ReaderPalette {
  return theme === "dark"
    ? {
        fg: "oklch(0.985 0 0)",
        bg: "oklch(0.141 0.005 285.823)",
        muted: "oklch(0.705 0.015 286.067)",
        quote: "oklch(1 0 0 / 10%)",
        preBg: "oklch(0.274 0.006 286.033)",
        link: "oklch(0.92 0.004 286.32)",
      }
    : {
        fg: "oklch(0.141 0.005 285.823)",
        bg: "oklch(1 0 0)",
        muted: "oklch(0.552 0.016 285.938)",
        quote: "oklch(0.92 0.004 286.32)",
        preBg: "oklch(0.967 0.001 286.375)",
        link: "oklch(0.21 0.006 285.885)",
      };
}

export function readerFontFamily(font: ReaderPrefs["font"]): string {
  return font === "serif"
    ? "Georgia, 'Iowan Old Style', 'Times New Roman', serif"
    : "system-ui, sans-serif";
}

interface ReaderSizes {
  base: string;
  h1: string;
}

export function readerSizes(size: ReaderPrefs["size"]): ReaderSizes {
  return {
    base: size === "sm" ? "14px" : size === "lg" ? "19px" : "16px",
    h1: size === "sm" ? "1.4em" : size === "lg" ? "1.8em" : "1.6em",
  };
}
