import type { ExtractedContent } from "../types";

// DOM adapters receive the already-fetched target HTML (SSRF-safe path
// upstream) and extract content via selectors. Pure: no fetching, no network.
export interface DomAdapter {
  name: string;
  kind: "dom";
  matches: (url: string) => boolean;
  adapt: (html: string, url: string) => ExtractedContent | null;
}

// Fetch adapters own their data source (a precise API beats scraping a page
// whose content sits past the HTML size cap). They must SSRF-guard via
// isSafeUrl if they derive the target URL from user input.
export interface FetchAdapter {
  name: string;
  kind: "fetch";
  matches: (url: string) => boolean;
  fetch: (url: string) => Promise<ExtractedContent | null>;
}

export type AdapterDefinition = DomAdapter | FetchAdapter;
