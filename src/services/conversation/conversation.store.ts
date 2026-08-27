import type { Message, Role } from "../../types.js";

const conversations = new Map<string, Message[]>();

function getOrCreateHistory(conversationId: string): Message[] {
  let history = conversations.get(conversationId);
  if (!history) {
    history = [];
    conversations.set(conversationId, history);
  }
  return history;
}

export function getHistory(conversationId: string): Message[] {
  return getOrCreateHistory(conversationId);
}

export function addMessage(
  conversationId: string,
  role: Role,
  content: string,
): void {
  const history = getOrCreateHistory(conversationId);
  history.push({ role, content });
}

export function clearHistory(conversationId: string): void {
  conversations.set(conversationId, []);
}

export function setHistory(
  conversationId: string,
  newHistory: Message[],
): void {
  conversations.set(conversationId, newHistory);
}
