import "dotenv/config";

export interface AppConfig {
  port: number;
  ollamaUrl: string;
  ollamaModel: string;
  ollamaEmbeddingModel: string;
  ollamaMaxContext: number | undefined;
  ollamaMaxTokens: number | undefined;
  openaiApiKey: string;
  openaiModel: string;
}

export const config: AppConfig = {
  port: process.env.PORT ? Number(process.env.PORT) : 3000,

  ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",

  ollamaModel: process.env.OLLAMA_MODEL || "llama3",

  ollamaMaxTokens: process.env.OLLAMA_MAX_TOKENS
    ? Number(process.env.OLLAMA_MAX_TOKENS)
    : undefined,

  ollamaMaxContext: process.env.OLLAMA_MAX_CONTEXT
    ? Number(process.env.OLLAMA_MAX_CONTEXT)
    : 4096,

  ollamaEmbeddingModel:
    process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text",

  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
};
