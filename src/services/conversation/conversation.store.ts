// This file stores conversation history IN MEMORY (in a plain variable).
// In other words: while the server is running, it remembers the messages.
// If you restart the server (ctrl+c and run it again), the history is
// gone. To persist it for real across restarts, you'd need to save it to
// a file or a database.
//
// Each conversation has its own history, stored by a "conversationId"
// inside a Map. Before this there was a single global array — meaning
// everyone using the API was talking in the SAME conversation. Now each
// ID has its own independent history, so you can have several conversations
// in parallel (e.g. multiple browser tabs, or different users) without
// mixing one's history with another's.

import type { Message, Role } from "../../types.js";

const conversations = new Map<string, Message[]>();

// Fetches a conversation's history; if that ID doesn't exist yet, creates
// an empty history on the spot. This way callers never get "undefined" —
// every conversation "is born" empty the first time it's used.
function getOrCreateHistory(conversationId: string): Message[] {
  let history = conversations.get(conversationId);
  if (!history) {
    history = [];
    conversations.set(conversationId, history);
  }
  return history;
}

/**
 * Returns all messages for a specific conversation.
 */
export function getHistory(conversationId: string): Message[] {
  return getOrCreateHistory(conversationId);
}

/**
 * Adds a new message to a specific conversation's history.
 */
export function addMessage(
  conversationId: string,
  role: Role,
  content: string,
): void {
  const history = getOrCreateHistory(conversationId);
  history.push({ role, content });
}

/**
 * Clears a specific conversation's history, starting it from scratch.
 * Other conversations (other IDs) are not affected.
 */
export function clearHistory(conversationId: string): void {
  conversations.set(conversationId, []);
}

/**
 * Replaces a conversation's entire history with a new list of messages.
 * Used, for example, to swap old messages for a summary.
 */
export function setHistory(
  conversationId: string,
  newHistory: Message[],
): void {
  conversations.set(conversationId, newHistory);
}
