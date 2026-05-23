import { createOllama } from "ollama-ai-provider-v2";

const apiKey = process.env.OLLAMA_API_KEY;

export const aiProvider = createOllama({
  baseURL: process.env.AI_BASE_URL ?? "https://ollama.com/api",
  headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
});
