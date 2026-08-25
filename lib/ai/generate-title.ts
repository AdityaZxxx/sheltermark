import { generateText } from "ai";

import { aiModel, aiProvider } from "./client";

interface GenerateTitleInput {
  url: string;
  currentTitle: string;
  description: string | null;
}

/**
 * Generates a concise, descriptive bookmark title from context.
 * Uses URL + existing title + page description as input.
 */
export async function generateBookmarkTitle({
  url,
  currentTitle,
  description,
}: GenerateTitleInput): Promise<string> {
  const { text } = await generateText({
    model: aiProvider(aiModel()),
    system:
      "You are an AI that generates concise, descriptive bookmark titles. Given a URL, current title, and description, produce a short (under 100 chars) title that accurately represents the page content.",
    prompt: [
      `URL: ${url}`,
      currentTitle ? `Existing Title: ${currentTitle}` : "",
      description ? `Description: ${description}` : "",
      "",
      "Generate a concise, descriptive title for this bookmark (max 100 characters):",
    ]
      .filter(Boolean)
      .join("\n"),
    maxOutputTokens: 100,
  });

  return text.trim().slice(0, 200);
}
