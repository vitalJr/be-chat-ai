import { describe, expect, it } from "vitest";
import type { Document } from "@langchain/core/documents";
import { buildContextFromChunks, reciprocalRankFusion } from "./vectorstore.service.js";

function makeChunk(pageContent: string, source?: string): Document {
  return { pageContent, metadata: source ? { source } : {} } as Document;
}

function makeIdChunk(chunkId: string, pageContent: string): Document {
  return { pageContent, metadata: { chunkId } } as Document;
}

describe("buildContextFromChunks", () => {
  it("returns undefined when there are no chunks", () => {
    expect(buildContextFromChunks([])).toBeUndefined();
  });

  it("includes the source and content of each chunk", () => {
    const context = buildContextFromChunks([makeChunk("hello world", "notes.pdf")]);

    expect(context).toContain("notes.pdf");
    expect(context).toContain("hello world");
  });

  it("falls back to 'unknown document' when a chunk has no source", () => {
    const context = buildContextFromChunks([makeChunk("no source here")]);

    expect(context).toContain("unknown document");
  });
});

describe("reciprocalRankFusion", () => {
  it("ranks a chunk that appears near the top of both lists above one that only appears in one", () => {
    const a = makeIdChunk("a", "chunk a");
    const b = makeIdChunk("b", "chunk b");
    const c = makeIdChunk("c", "chunk c");

    const vectorList = [a, b, c];
    const keywordList = [a, c];

    const result = reciprocalRankFusion([vectorList, keywordList]);

    expect(result.map((chunk) => chunk.metadata.chunkId)).toEqual(["a", "c", "b"]);
  });

  it("rescues a chunk that keyword search found but vector search missed entirely", () => {
    const missedByVector = makeIdChunk("exact-match", "contract #48291-B");
    const foundByVector = makeIdChunk("topically-similar", "something about contracts");

    const vectorList = [foundByVector];
    const keywordList = [missedByVector];

    const result = reciprocalRankFusion([vectorList, keywordList]);

    expect(result.map((chunk) => chunk.metadata.chunkId)).toContain("exact-match");
  });

  it("returns an empty list when given no ranked lists", () => {
    expect(reciprocalRankFusion([[], []])).toEqual([]);
  });

  it("falls back to pageContent as the dedup key when chunkId is missing", () => {
    const chunk = makeChunk("same text, no id");

    const result = reciprocalRankFusion([[chunk], [chunk]]);

    expect(result).toHaveLength(1);
  });
});
