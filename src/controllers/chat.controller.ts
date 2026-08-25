// "Controller" layer: receives the HTTP request (req), validates the
// input data, calls the service that does the heavy lifting (talking to
// Ollama), and returns the HTTP response (res). The controller does NOT
// know how Ollama works internally — it just uses the function the
// service offers.

import type { Request, Response } from "express";
import {
  askOllamaChatStream,
  summarizeConversation,
} from "../services/ollama/ollama.service.js";
import {
  getHistory,
  addMessage,
  clearHistory,
  setHistory,
} from "../services/conversation/conversation.store.js";
import {
  searchRelevantChunks,
  buildContextFromChunks,
} from "../services/vectorstore/vectorstore.service.js";
import { chatGraph } from "../services/chat.graph.js";

// Once history passes this number of messages, the oldest ones get summarized
const MAX_MESSAGES_BEFORE_SUMMARY = 10;
// How many recent messages stay "raw" (not summarized), to keep short-term accuracy
const RECENT_MESSAGES_TO_KEEP = 4;

// ID used when the client doesn't provide a conversationId — this way
// whoever never sends that parameter keeps the same behavior as before
// (a single "default" conversation), without needing to change anything on their side.
const DEFAULT_CONVERSATION_ID = "default";

// Expected shape of the request body in POST /api/chat
interface ChatRequestBody {
  message?: string;
}

// Reads "?conversationId=..." from the URL. If nothing is provided (or
// it's empty), falls back to the default ID — that's how having multiple
// conversations stays "optional": whoever wants separate conversations
// sends the parameter, whoever doesn't won't notice a difference.
function resolveConversationId(req: Request): string {
  const raw = req.query.conversationId;

  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw;
  }

  return DEFAULT_CONVERSATION_ID;
}

export async function handleChat(
  req: Request<{}, {}, ChatRequestBody>,
  res: Response,
) {
  const { message } = req.body;
  const conversationId = resolveConversationId(req);

  // Simple validation: without a message, there's nothing to ask the AI
  if (!message || typeof message !== "string") {
    return res.status(400).json({
      error: 'Please send a "message" field (text) in the request body.',
    });
  }
  try {
    // 1) Store the user's question in THIS conversation's history
    addMessage(conversationId, "user", message);

    // 2) Run the retrieve -> generate graph (see chat.graph.ts) over this
    //    conversation's ENTIRE history. The graph handles both searching
    //    the uploaded documents for relevant chunks (RAG) and asking
    //    Ollama for a reply — the same two steps this controller used to
    //    call directly, now expressed as an explicit graph instead of
    //    two separate function calls.
    const result = await chatGraph.invoke({
      messages: getHistory(conversationId),
    });
    const reply = result.reply;

    // 3) Store the AI's response too, so it enters the context of the next question
    addMessage(conversationId, "assistant", reply);

    // 4) If the history is already large, summarize the oldest messages
    //    (this happens "after" responding, so it doesn't make the user wait)
    await summarizeHistoryIfNeeded(conversationId);

    return res.json({ reply, conversationId });
  } catch (error) {
    const err = error as Error;
    console.error("Error querying Ollama:", err.message);
    return res.status(500).json({ error: err.message });
  }
}

// Same as handleChat, but returns the response in CHUNKS as the AI
// generates them, instead of making the client wait for the full text to be ready.
export async function handleChatStream(
  req: Request<{}, {}, ChatRequestBody>,
  res: Response,
) {
  const { message } = req.body;
  const conversationId = resolveConversationId(req);

  if (!message || typeof message !== "string") {
    return res.status(400).json({
      error: 'Please send a "message" field (text) in the request body.',
    });
  }

  addMessage(conversationId, "user", message);

  // Setting this header is enough for Express to send each res.write()
  // as soon as it's called (chunked transfer encoding), instead of
  // buffering everything and only sending it at the end
  res.setHeader("Content-Type", "text/plain; charset=utf-8");

  try {
    const relevantChunks = await searchRelevantChunks(message);
    const extraContext = buildContextFromChunks(relevantChunks);

    const fullReply = await askOllamaChatStream(
      getHistory(conversationId),
      (chunk) => {
        res.write(chunk);
      },
      extraContext,
    );

    addMessage(conversationId, "assistant", fullReply);
    await summarizeHistoryIfNeeded(conversationId);

    res.end();
  } catch (error) {
    const err = error as Error;
    console.error("Error querying Ollama (stream):", err.message);

    // If we've already sent some chunk, we can no longer change the HTTP
    // status (headers were already sent), so we just report it in the text itself
    if (!res.headersSent) {
      res.status(500);
    }
    res.end(`\n[error: ${err.message}]`);
  }
}

/**
 * If a conversation's history goes over MAX_MESSAGES_BEFORE_SUMMARY
 * messages, takes the oldest ones, asks the AI to summarize them in a
 * paragraph, and replaces that chunk with a single summary message —
 * keeping the most recent messages intact. This reduces the tokens sent
 * in future calls. Only affects that conversationId's history, no other.
 */
async function summarizeHistoryIfNeeded(conversationId: string): Promise<void> {
  const history = getHistory(conversationId);

  if (history.length <= MAX_MESSAGES_BEFORE_SUMMARY) {
    return; // history is still small, no need to summarize
  }

  const oldMessages = history.slice(
    0,
    history.length - RECENT_MESSAGES_TO_KEEP,
  );
  const recentMessages = history.slice(
    history.length - RECENT_MESSAGES_TO_KEEP,
  );

  const summary = await summarizeConversation(oldMessages);

  setHistory(conversationId, [
    {
      role: "system",
      content: `Summary of the conversation so far: ${summary}`,
    },
    ...recentMessages,
  ]);
}

// Endpoint to start a new conversation, wiping the current history.
// Only deletes the conversation given in ?conversationId=... — the others stay intact.
export function handleClearChat(req: Request, res: Response) {
  const conversationId = resolveConversationId(req);
  clearHistory(conversationId);
  return res.json({ status: "history cleared", conversationId });
}

// DEBUG endpoint: shows exactly what's currently stored in memory for
// the conversation given in ?conversationId=... (or "default", if omitted).
export function handleGetHistory(req: Request, res: Response) {
  const conversationId = resolveConversationId(req);
  return res.json({ conversationId, history: getHistory(conversationId) });
}
