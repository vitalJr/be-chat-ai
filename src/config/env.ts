import "dotenv/config";

export interface AppConfig {
  port: number;
  ollamaUrl: string;
  ollamaModel: string;
  ollamaToolModel: string;
  ollamaEmbeddingModel: string;
  ollamaMaxContext: number | undefined;
  ollamaMaxTokens: number | undefined;
  openaiApiKey: string;
  openaiModel: string;
  serpApiKey: string;
  whisperModel: string;
  whisperLanguage: string | undefined;
  conversationDbPath: string;
}

export const config: AppConfig = {
  port: process.env.PORT ? Number(process.env.PORT) : 3000,

  ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",

  ollamaModel: process.env.OLLAMA_MODEL || "llama3",

  ollamaToolModel: process.env.OLLAMA_TOOL_MODEL || "llama3.2",

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

  serpApiKey: process.env.SERPAPI_API_KEY || "",

  whisperModel: process.env.WHISPER_MODEL || "Xenova/whisper-base",
  whisperLanguage: process.env.WHISPER_LANGUAGE || undefined,

  conversationDbPath:
    process.env.VITEST === "true"
      ? ":memory:"
      : process.env.CONVERSATION_DB_PATH || "conversations.db",
};
