import { createOllama } from "ollama-ai-provider-v2";

const apiKey = process.env.OLLAMA_API_KEY;

export const aiProvider = createOllama({
  baseURL: process.env.AI_BASE_URL ?? "https://ollama.com/api",
  headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
});

// Validated lazily so importing this module (e.g. in tests) doesn't throw.
export function aiModel(): string {
  const model = process.env.AI_MODEL;
  if (!model) {
    throw new Error("AI_MODEL environment variable is not set");
  }
  return model;
}
