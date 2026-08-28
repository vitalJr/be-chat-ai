import { DatabaseSync } from "node:sqlite";
import { config } from "../../config/env.js";
import type { Message, Role } from "../../types.js";

const db = new DatabaseSync(config.conversationDbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL
  )
`);

const insertMessageStatement = db.prepare(
  "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)",
);
const selectHistoryStatement = db.prepare(
  "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id",
);
const deleteHistoryStatement = db.prepare(
  "DELETE FROM messages WHERE conversation_id = ?",
);

export function getHistory(conversationId: string): Message[] {
  const rows = selectHistoryStatement.all(conversationId) as {
    role: Role;
    content: string;
  }[];

  return rows.map((row) => ({ role: row.role, content: row.content }));
}

export function addMessage(
  conversationId: string,
  role: Role,
  content: string,
): void {
  insertMessageStatement.run(conversationId, role, content);
}

export function clearHistory(conversationId: string): void {
  deleteHistoryStatement.run(conversationId);
}

export function setHistory(
  conversationId: string,
  newHistory: Message[],
): void {
  db.exec("BEGIN");
  try {
    deleteHistoryStatement.run(conversationId);
    for (const message of newHistory) {
      insertMessageStatement.run(conversationId, message.role, message.content);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
