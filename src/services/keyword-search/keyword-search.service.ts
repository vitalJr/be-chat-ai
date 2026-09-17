import MiniSearch from "minisearch";
import type { Document } from "@langchain/core/documents";

interface IndexedChunk {
  id: string;
  content: string;
  source: string;
  userId: string;
}

const miniSearch = new MiniSearch<IndexedChunk>({
  fields: ["content"],
  storeFields: ["content", "source", "userId"],
  idField: "id",
});

export function indexChunks(chunks: Document[]): void {
  const docs: IndexedChunk[] = chunks
    .filter((chunk) => typeof chunk.metadata.chunkId === "string")
    .map((chunk) => ({
      id: chunk.metadata.chunkId as string,
      content: chunk.pageContent,
      source: String(chunk.metadata.source ?? "unknown"),
      userId: String(chunk.metadata.userId ?? ""),
    }));

  if (docs.length > 0) {
    miniSearch.addAll(docs);
  }
}

export function isIndexEmpty(): boolean {
  return miniSearch.documentCount === 0;
}

export function searchKeywords(
  query: string,
  userId: string,
  limit: number,
): Document[] {
  const results = miniSearch.search(query, {
    filter: (result) => result.userId === userId,
  });

  return results.slice(0, limit).map((result) => ({
    pageContent: result.content as string,
    metadata: {
      source: result.source,
      userId: result.userId,
      chunkId: result.id,
    },
  }));
}
