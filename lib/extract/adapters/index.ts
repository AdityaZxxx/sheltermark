import type { AdapterDefinition } from "./types";

import { hackerNewsAdapter } from "./hackernews";
import { redditAdapter } from "./reddit";
import { xAdapter } from "./x";

// Ordered: first matching adapter wins; null result falls back to the generic
// Readability path in extract-content.ts. GitHub used to live here; the
// native proxy (ADR-0007) renders it instead.
const ADAPTERS: AdapterDefinition[] = [
  hackerNewsAdapter,
  xAdapter,
  redditAdapter,
];

export function findAdapter(url: string): AdapterDefinition | null {
  return ADAPTERS.find((a) => a.matches(url)) ?? null;
}
