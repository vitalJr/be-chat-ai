// This file is responsible for centralizing the application's configuration.
// The idea is: instead of scattering "process.env.SOMETHING" across the
// whole codebase, we read everything here ONCE and export it as a simple,
// typed object.

import "dotenv/config"; // loads variables from the .env file into process.env

export interface AppConfig {
  port: number;
  ollamaUrl: string;
  ollamaModel: string;
  ollamaEmbeddingModel: string;
  openaiApiKey: string;
  openaiModel: string;
}

export const config: AppConfig = {
  port: process.env.PORT ? Number(process.env.PORT) : 3000,

  // Default Ollama URL when it's installed locally
  ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",

  // Model used for chat calls (e.g. llama3, mistral, phi3...)
  ollamaModel: process.env.OLLAMA_MODEL || "llama3",

  // Model specialized in generating text embeddings (vectors), used for
  // document search (RAG). Different from the chat model.
  // Must be pulled beforehand: `ollama pull nomic-embed-text`
  ollamaEmbeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text",

  // --- Example config for comparison with OpenAI (paid) ---
  // The key is secret: it only lives in .env, never in code or in git.
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
};
