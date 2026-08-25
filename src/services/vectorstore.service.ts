// This is the heart of RAG (Retrieval-Augmented Generation): a "search
// index by meaning". Each document chunk becomes a vector of numbers
// (embedding) that represents its meaning. When the user asks something,
// we turn the question into the same kind of vector and look for the
// document chunks with the most SIMILAR vectors — this isn't keyword
// search, it's search by meaning.
//
// Just like conversation.store.ts, this lives in memory: restarting the
// server wipes the index (the files stay saved in uploads/, but would
// need to be reprocessed). To persist it for real, you'd swap
// MemoryVectorStore for a real vector store (e.g. Chroma, pgvector).

import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { OllamaEmbeddings } from "@langchain/ollama";
import type { Document } from "@langchain/core/documents";
import { config } from "../config/env.js";

// OllamaEmbeddings is a DIFFERENT model from the chat model — specialized
// in turning text into vectors, not in generating responses.
const embeddings = new OllamaEmbeddings({
  model: config.ollamaEmbeddingModel,
  baseUrl: config.ollamaUrl,
});

const vectorStore = new MemoryVectorStore(embeddings);

/**
 * Adds pieces (chunks) of an already-loaded document to the search index.
 * Under the hood, generates an embedding for each chunk.
 */
export async function addDocumentChunks(chunks: Document[]): Promise<void> {
  await vectorStore.addDocuments(chunks);
}

/**
 * Searches for the document chunks most similar (semantically) to the
 * user's question. If no document has been uploaded yet, returns an
 * empty list — no error.
 */
export async function searchRelevantChunks(
  query: string,
  k = 3,
): Promise<Document[]> {
  return vectorStore.similaritySearch(query, k);
}

/**
 * Builds a block of text with the relevant chunks, ready to be injected
 * as extra context in a call to Ollama. Returns undefined if there's
 * nothing relevant — this way the chat keeps working normally for
 * whoever hasn't uploaded any document.
 */
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
