import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { OllamaEmbeddings } from "@langchain/ollama";
import type { Document } from "@langchain/core/documents";
import { config } from "../../config/env.js";

const embeddings = new OllamaEmbeddings({
  model: config.ollamaEmbeddingModel,
  baseUrl: config.ollamaUrl,
});

const vectorStore = new MemoryVectorStore(embeddings);

const MIN_RELEVANCE_SCORE = 0.5;

const DOCUMENT_EMBEDDING_PREFIX = "search_document: ";
const QUERY_EMBEDDING_PREFIX = "search_query: ";

export async function addDocumentChunks(chunks: Document[]): Promise<void> {
  const prefixedTexts = chunks.map(
    (chunk) => `${DOCUMENT_EMBEDDING_PREFIX}${chunk.pageContent}`,
  );
  const vectors = await embeddings.embedDocuments(prefixedTexts);
  await vectorStore.addVectors(vectors, chunks);
}

export async function searchRelevantChunks(
  query: string,
  k = 3,
): Promise<Document[]> {
  const queryVector = await embeddings.embedQuery(
    `${QUERY_EMBEDDING_PREFIX}${query}`,
  );
  const scoredChunks = await vectorStore.similaritySearchVectorWithScore(queryVector, k);

  return scoredChunks
    .filter(([, score]) => score >= MIN_RELEVANCE_SCORE)
    .map(([chunk]) => chunk);
}

export function buildContextFromChunks(chunks: Document[]): string | undefined {
  if (chunks.length === 0) return undefined;

  const formatted = chunks
    .map((chunk, i) => {
      const source = chunk.metadata.source ?? "unknown document";
      return `Excerpt ${i + 1} (source: ${source}):\n${chunk.pageContent}`;
    })
    .join("\n\n---\n\n");

  return (
    "Use the information below, extracted from documents uploaded by the " +
    "user, to help answer — but ONLY if it's relevant to the question " +
    "asked. If it's unrelated, ignore it and answer normally using your " +
    "own knowledge.\n\n" +
    formatted
  );
}
