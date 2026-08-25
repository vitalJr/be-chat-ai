// Smoke test for buildContextFromChunks: it's a pure function (no Ollama
// call, no I/O), so it's the easiest piece of RAG logic to test in
// isolation. Sets up the Vitest wiring for the rest of the project — more
// tests can be added the same way as coverage grows.
import { describe, expect, it } from "vitest";
import type { Document } from "@langchain/core/documents";
import { buildContextFromChunks } from "./vectorstore.service.js";

function makeChunk(pageContent: string, source?: string): Document {
  return { pageContent, metadata: source ? { source } : {} } as Document;
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
