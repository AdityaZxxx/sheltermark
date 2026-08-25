import { generateText } from "ai";
import { z } from "zod";

import { aiModel, aiProvider } from "./client";

export const MAX_TAG_SUGGESTIONS = 5;

const MAX_TAG_NAME_LENGTH = 50;

const suggestionsEnvelopeSchema = z.object({
  tags: z.array(z.unknown()),
});

/**
 * Parses and normalizes the model's raw output into safe tag candidates.
 * Expects a JSON object like {"tags": ["a", "b"]}; malformed output yields
 * an empty list rather than an error, so the UI falls back to manual tagging.
 */
export function parseTagSuggestions(raw: string): string[] {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return [];

  let json: unknown;
  try {
    json = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }

  const envelope = suggestionsEnvelopeSchema.safeParse(json);
  if (!envelope.success) return [];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of envelope.data.tags) {
    const candidate = z.string().safeParse(item);
    if (!candidate.success) continue;
    const name = candidate.data
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, MAX_TAG_NAME_LENGTH);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= MAX_TAG_SUGGESTIONS) break;
  }
  return out;
}

interface GenerateTagSuggestionsInput {
  url: string;
  title: string;
  note: string | null;
  existingTags: string[];
}

/**
 * Generates tag name candidates from the bookmark's own text context,
 * biased toward the user's existing tag vocabulary.
 */
export async function generateTagSuggestions({
  url,
  title,
  note,
  existingTags,
}: GenerateTagSuggestionsInput): Promise<string[]> {
  const { text } = await generateText({
    model: aiProvider(aiModel()),
    system:
      'You are an AI that suggests bookmark tags. Given a URL, title, note, and the user\'s existing tags, suggest 2-5 short lowercase tags. Prefer reusing the user\'s existing tags when they fit; otherwise propose concise new ones. Respond ONLY with JSON: {"tags": ["tag1", "tag2"]}',
    prompt: [
      `URL: ${url}`,
      title ? `Title: ${title}` : "",
      note ? `Note: ${note}` : "",
      existingTags.length > 0
        ? `Existing Tags: ${existingTags.join(", ")}`
        : "Existing Tags: none",
      "",
      "Suggest tags as JSON.",
    ]
      .filter(Boolean)
      .join("\n"),
    maxOutputTokens: 150,
  });

  return parseTagSuggestions(text);
}
