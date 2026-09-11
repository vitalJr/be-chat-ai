import { db } from "../conversation/conversation.store.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

const insertUserStatement = db.prepare(
  "INSERT INTO users (username, password_hash) VALUES (?, ?)",
);
const selectUserByUsernameStatement = db.prepare(
  "SELECT id, username, password_hash FROM users WHERE username = ?",
);

export interface UserRecord {
  id: number;
  username: string;
  passwordHash: string;
}

export function createUser(username: string, passwordHash: string): void {
  insertUserStatement.run(username, passwordHash);
}

export function findUserByUsername(username: string): UserRecord | undefined {
  const row = selectUserByUsernameStatement.get(username) as
    | { id: number; username: string; password_hash: string }
    | undefined;

  if (!row) return undefined;

  return { id: row.id, username: row.username, passwordHash: row.password_hash };
}
