import { Chroma } from "@langchain/community/vectorstores/chroma";
import { CloudClient } from "chromadb";
import { OllamaEmbeddings } from "@langchain/ollama";
import type { Document } from "@langchain/core/documents";
import { config } from "../../config/env.js";

const embeddings = new OllamaEmbeddings({
  model: config.ollamaEmbeddingModel,
  baseUrl: config.ollamaUrl,
});

let vectorStore: Chroma | undefined;

function getVectorStore(): Chroma {
  if (!vectorStore) {
    const chromaClient = new CloudClient({
      apiKey: config.chromaApiKey,
      tenant: config.chromaTenant,
      database: config.chromaDatabase,
      ...(config.chromaHost ? { host: config.chromaHost } : {}),
    });

    vectorStore = new Chroma(embeddings, {
      index: chromaClient,
      collectionName: config.chromaCollectionName,
      collectionMetadata: { "hnsw:space": "cosine" },
    });
  }

  return vectorStore;
}

const MIN_RELEVANCE_SCORE = 0.5;
const MAX_CANDIDATES_TO_SCORE = 300;
const TOTAL_CHUNK_BUDGET = 12;
const MIN_CHUNKS_PER_SOURCE = 2;

const DOCUMENT_EMBEDDING_PREFIX = "search_document: ";
const QUERY_EMBEDDING_PREFIX = "search_query: ";

export async function addDocumentChunks(chunks: Document[]): Promise<void> {
  const prefixedTexts = chunks.map(
    (chunk) => `${DOCUMENT_EMBEDDING_PREFIX}${chunk.pageContent}`,
  );
  const vectors = await embeddings.embedDocuments(prefixedTexts);
  await getVectorStore().addVectors(vectors, chunks);
}

export async function listIndexedSources(): Promise<string[]> {
  const collection = await getVectorStore().ensureCollection();
  const { metadatas } = await collection.get({ include: ["metadatas"] });

  const sources = metadatas.map((metadata) =>
    String(metadata?.source ?? "unknown"),
  );

  return Array.from(new Set(sources));
}

export async function searchRelevantChunks(query: string): Promise<Document[]> {
  const queryVector = await embeddings.embedQuery(
    `${QUERY_EMBEDDING_PREFIX}${query}`,
  );
  const scoredChunks = await getVectorStore().similaritySearchVectorWithScore(
    queryVector,
    MAX_CANDIDATES_TO_SCORE,
  );

  const relevantChunks = scoredChunks
    .map(([chunk, cosineDistance]) => ({
      chunk,
      similarityScore: 1 - cosineDistance,
    }))
    .filter(({ similarityScore }) => similarityScore >= MIN_RELEVANCE_SCORE);

  const distinctSources = new Set(
    relevantChunks.map(({ chunk }) =>
      String(chunk.metadata.source ?? "unknown"),
    ),
  ).size;

  const chunksPerSource = Math.max(
    MIN_CHUNKS_PER_SOURCE,
    Math.floor(TOTAL_CHUNK_BUDGET / distinctSources),
  );

  const relevantChunksBySource = new Map<string, Document[]>();

  for (const { chunk } of relevantChunks) {
    const source = String(chunk.metadata.source ?? "unknown");
    const chunksForSource = relevantChunksBySource.get(source) ?? [];

    if (chunksForSource.length < chunksPerSource) {
      chunksForSource.push(chunk);
      relevantChunksBySource.set(source, chunksForSource);
    }
  }

  return Array.from(relevantChunksBySource.values()).flat();
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
    "<steps_to_follow>\n" +
    "When the answer is found in a document below, tell the user which " +
    "document it came from and quote the relevant excerpt verbatim.\n" +
    "</steps_to_follow>\n\n" +
    "<response_format_example>\n" +
    'According to the document "<source>", the answer is: "<exact quoted excerpt>".\n' +
    "</response_format_example>\n\n" +
    formatted
  );
}
