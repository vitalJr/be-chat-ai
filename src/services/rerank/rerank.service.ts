import {
  AutoModelForSequenceClassification,
  AutoTokenizer,
  env,
  type PreTrainedModel,
  type PreTrainedTokenizer,
} from "@huggingface/transformers";
import type { Document } from "@langchain/core/documents";
import { config } from "../../config/env.js";

env.cacheDir = "./.cache/transformers";

interface Reranker {
  tokenizer: PreTrainedTokenizer;
  model: PreTrainedModel;
}

let rerankerPromise: Promise<Reranker> | undefined;

function getReranker(): Promise<Reranker> {
  if (!rerankerPromise) {
    rerankerPromise = Promise.all([
      AutoTokenizer.from_pretrained(config.rerankModel),
      AutoModelForSequenceClassification.from_pretrained(config.rerankModel),
    ]).then(([tokenizer, model]) => ({ tokenizer, model }));
  }

  return rerankerPromise;
}

async function scoreChunk(
  reranker: Reranker,
  query: string,
  chunkText: string,
): Promise<number> {
  const inputs = await reranker.tokenizer(query, {
    text_pair: chunkText,
    padding: true,
    truncation: true,
  });
  const { logits } = await reranker.model(inputs);
  return logits.data[0] as number;
}

export async function rerankChunks(
  query: string,
  chunks: Document[],
): Promise<Document[]> {
  if (chunks.length === 0) return chunks;

  const reranker = await getReranker();

  const scoredChunks = await Promise.all(
    chunks.map(async (chunk) => ({
      chunk,
      score: await scoreChunk(reranker, query, chunk.pageContent),
    })),
  );

  return scoredChunks
    .sort((a, b) => b.score - a.score)
    .map(({ chunk }) => chunk);
}
