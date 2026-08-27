// Central catalog of every agent the API can invoke. Adding a new agent
// means: create its file in src/agents/, then list it in the array
// below — nothing else in the app needs to change (the controller and
// the /api/agents route both go through getAgent()/listAgents() only).
import type { AgentDefinition } from "../agents/agent.types.js";
import { documentAssistantAgent } from "../agents/document-assistant.agent.js";
import { generalAssistantAgent } from "../agents/general-assistant.agent.js";
import { translatorAgent } from "../agents/translator.agent.js";
import { veterinaryAssistantAgent } from "../agents/veterinary-assistant.agent.js";

const REGISTERED_AGENTS: AgentDefinition[] = [
  documentAssistantAgent,
  generalAssistantAgent,
  translatorAgent,
  veterinaryAssistantAgent,
];

// Used when the client doesn't specify ?agentId=... — same "optional
// parameter, sane default" pattern as conversationId in chat.controller.ts.
export const DEFAULT_AGENT_ID = documentAssistantAgent.id;

const agentsById = new Map<string, AgentDefinition>(
  REGISTERED_AGENTS.map((agent) => [agent.id, agent]),
);

/**
 * Looks up an agent by id. Returns undefined if no agent with that id is
 * registered — the caller decides how to handle that (see
 * chat.controller.ts, which turns it into a 400 response).
 */
export function getAgent(agentId: string): AgentDefinition | undefined {
  return agentsById.get(agentId);
}

export interface AgentSummary {
  id: string;
  name: string;
  description: string;
}

/**
 * Lists every registered agent's public info (id, name, description) —
 * what GET /api/agents returns, so clients know what's available to
 * pass as ?agentId=....
 */
export function listAgents(): AgentSummary[] {
  return REGISTERED_AGENTS.map(({ id, name, description }) => ({
    id,
    name,
    description,
  }));
}
