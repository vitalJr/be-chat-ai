import { DatabaseSync } from "node:sqlite";
import { config } from "../../config/env.js";
import type { Message, Role } from "../../types.js";

export const db = new DatabaseSync(config.conversationDbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL
  )
`);

const messageColumns = db.prepare("PRAGMA table_info(messages)").all() as {
  name: string;
}[];
if (!messageColumns.some((column) => column.name === "user_id")) {
  db.exec("ALTER TABLE messages ADD COLUMN user_id TEXT NOT NULL DEFAULT ''");
}

db.exec(
  "CREATE INDEX IF NOT EXISTS idx_messages_user_conversation ON messages (user_id, conversation_id)",
);

const insertMessageStatement = db.prepare(
  "INSERT INTO messages (user_id, conversation_id, role, content) VALUES (?, ?, ?, ?)",
);
const selectHistoryStatement = db.prepare(
  "SELECT role, content FROM messages WHERE user_id = ? AND conversation_id = ? ORDER BY id",
);
const deleteHistoryStatement = db.prepare(
  "DELETE FROM messages WHERE user_id = ? AND conversation_id = ?",
);

export function getHistory(userId: string, conversationId: string): Message[] {
  const rows = selectHistoryStatement.all(userId, conversationId) as {
    role: Role;
    content: string;
  }[];

  return rows.map((row) => ({ role: row.role, content: row.content }));
}

export function addMessage(
  userId: string,
  conversationId: string,
  role: Role,
  content: string,
): void {
  insertMessageStatement.run(userId, conversationId, role, content);
}

export function clearHistory(userId: string, conversationId: string): void {
  deleteHistoryStatement.run(userId, conversationId);
}

export function setHistory(
  userId: string,
  conversationId: string,
  newHistory: Message[],
): void {
  db.exec("BEGIN");
  try {
    deleteHistoryStatement.run(userId, conversationId);
    for (const message of newHistory) {
      insertMessageStatement.run(
        userId,
        conversationId,
        message.role,
        message.content,
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
