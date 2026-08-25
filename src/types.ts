// Types shared across several files in the project.
// Kept in their own file so they don't need to be redefined everywhere.

export type Role = "user" | "assistant" | "system";

export interface Message {
  role: Role;
  content: string;
}
