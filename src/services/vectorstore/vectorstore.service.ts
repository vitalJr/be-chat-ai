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
import { config } from "../../config/env.js";

// OllamaEmbeddings is a DIFFERENT model from the chat model — specialized
// in turning text into vectors, not in generating responses.
const embeddings = new OllamaEmbeddings({
  model: config.ollamaEmbeddingModel,
  baseUrl: config.ollamaUrl,
});

const vectorStore = new MemoryVectorStore(embeddings);

// MemoryVectorStore scores by cosine similarity (0 = unrelated, 1 =
// identical). Without a floor here, searchRelevantChunks always returns
// the "closest" k chunks it has — even when none of them actually relate
// to the question — and that noise gets injected into every chat message
// once a single document has ever been uploaded. This is a heuristic
// starting point, not a precise number: tune it up if irrelevant chunks
// still slip through, or down if genuinely relevant chunks get dropped.
const MIN_RELEVANCE_SCORE = 0.5;

// nomic-embed-text (config.ollamaEmbeddingModel's default) is an
// ASYMMETRIC embedding model: it was trained to expect a task prefix
// telling it whether the text being embedded is something to be found
// (a document) or something doing the searching (a query). Embedding
// both sides the same way — what we did before — measurably hurts
// retrieval accuracy for this model. See:
// https://ollama.com/library/nomic-embed-text
const DOCUMENT_EMBEDDING_PREFIX = "search_document: ";
const QUERY_EMBEDDING_PREFIX = "search_query: ";

/**
 * Adds pieces (chunks) of an already-loaded document to the search index.
 * Embeds each chunk with the "search_document:" prefix nomic-embed-text
 * expects, but stores the chunk's ORIGINAL, unprefixed pageContent —
 * addVectors() (unlike addDocuments()) lets the embedded text and the
 * stored text differ, so the prefix never leaks into what later gets
 * injected into the LLM's context via buildContextFromChunks().
 */
export async function addDocumentChunks(chunks: Document[]): Promise<void> {
  const prefixedTexts = chunks.map(
    (chunk) => `${DOCUMENT_EMBEDDING_PREFIX}${chunk.pageContent}`,
  );
  const vectors = await embeddings.embedDocuments(prefixedTexts);
  await vectorStore.addVectors(vectors, chunks);
}

/**
 * Searches for the document chunks most similar (semantically) to the
 * user's question, discarding anything below MIN_RELEVANCE_SCORE. If no
 * document has been uploaded yet, or nothing clears the relevance bar,
 * returns an empty list — no error.
 */
export async function searchRelevantChunks(
  query: string,
  k = 3,
): Promise<Document[]> {
  // Same asymmetric-embedding reasoning as addDocumentChunks, but with
  // the query-side prefix instead. Using similaritySearchVectorWithScore
  // (which takes an already-computed vector) instead of
  // similaritySearchWithScore (which would embed the raw, unprefixed
  // query itself) is what lets us control this.
  const queryVector = await embeddings.embedQuery(
    `${QUERY_EMBEDDING_PREFIX}${query}`,
  );
  const scoredChunks = await vectorStore.similaritySearchVectorWithScore(queryVector, k);

  return scoredChunks
    .filter(([, score]) => score >= MIN_RELEVANCE_SCORE)
    .map(([chunk]) => chunk);
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
