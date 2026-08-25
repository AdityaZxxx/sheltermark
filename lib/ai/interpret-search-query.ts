import { generateText } from "ai";
import { z } from "zod";

import { aiModel, aiProvider } from "./client";

export const MAX_SEARCH_TERMS = 8;

const MAX_TERM_LENGTH = 50;

const termsEnvelopeSchema = z.object({
  terms: z.array(z.unknown()),
});

/**
 * Parses and normalizes the model's raw output into safe search terms.
 * Expects a JSON object like {"terms": ["a", "b"]}; malformed output yields
 * an empty list rather than an error, so the client falls back to regular
 * full-text search on the original query.
 */
export function parseSearchTerms(raw: string): string[] {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return [];

  let json: unknown;
  try {
    json = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }

  const envelope = termsEnvelopeSchema.safeParse(json);
  if (!envelope.success) return [];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of envelope.data.terms) {
    const candidate = z.string().safeParse(item);
    if (!candidate.success) continue;
    const term = candidate.data
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, MAX_TERM_LENGTH);
    const key = term.toLowerCase();
    if (!term || seen.has(key)) continue;
    seen.add(key);
    out.push(term);
    if (out.length >= MAX_SEARCH_TERMS) break;
  }
  return out;
}

/**
 * Rewrites a natural-language search request into plain FTS terms.
 * The model never sees bookmark data and never invents synonyms —
 * it only strips conversational filler from the user's query.
 */
export async function generateSearchTerms({
  query,
}: {
  query: string;
}): Promise<string[]> {
  const { text } = await generateText({
    model: aiProvider(aiModel()),
    system:
      'You rewrite natural-language search requests into plain search terms for a bookmark manager. Extract 1-8 meaningful search terms from the query. Remove conversational filler such as "find", "show me", "my bookmarks", "saved links", "I want", "give me". Keep product names, technology names, and proper nouns exactly as written. Do NOT add synonyms or related words that are not in the query. Respond ONLY with JSON: {"terms": ["term1", "term2"]}',
    prompt: `Query: ${query}\n\nExtract the search terms as JSON.`,
    maxOutputTokens: 300,
    // A hung provider must not pin the search UI in its loading state.
    abortSignal: AbortSignal.timeout(15_000),
  });

  return parseSearchTerms(text);
}
