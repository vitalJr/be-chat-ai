// Shared contract every agent must implement, regardless of what its
// internal graph looks like (RAG, plain chat, tool-calling, whatever).
// The registry and the controller only ever talk to agents through this
// interface — they never need to know an agent's internal state shape.
import type { Message } from "../types.js";

export interface AgentDefinition {
  // Used in the ?agentId=... query param and in GET /api/agents
  id: string;
  // Human-readable name, shown in GET /api/agents
  name: string;
  // What this agent does differently, shown in GET /api/agents
  description: string;
  // Runs the agent over a conversation's full history and returns its reply
  invoke(messages: Message[]): Promise<string>;
}
