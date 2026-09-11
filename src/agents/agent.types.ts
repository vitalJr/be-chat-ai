import type { Message } from "../types.js";

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  invoke(messages: Message[], userId: string): Promise<string>;
}
