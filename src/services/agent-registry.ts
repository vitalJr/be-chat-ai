import type { AgentDefinition } from "../agents/agent.types.js";
import { documentAssistantAgent } from "../agents/document-assistant.agent.js";
import { generalAssistantAgent } from "../agents/general-assistant.agent.js";
import { translatorAgent } from "../agents/translator.agent.js";
import { veterinaryAssistantAgent } from "../agents/veterinary-assistant.agent.js";
import { webSearchAgent } from "../agents/web-search.agent.js";

const REGISTERED_AGENTS: AgentDefinition[] = [
  documentAssistantAgent,
  generalAssistantAgent,
  translatorAgent,
  veterinaryAssistantAgent,
  webSearchAgent,
];

export const DEFAULT_AGENT_ID = documentAssistantAgent.id;

const agentsById = new Map<string, AgentDefinition>(
  REGISTERED_AGENTS.map((agent) => [agent.id, agent]),
);

export function getAgent(agentId: string): AgentDefinition | undefined {
  return agentsById.get(agentId);
}

export interface AgentSummary {
  id: string;
  name: string;
  description: string;
}

export function listAgents(): AgentSummary[] {
  return REGISTERED_AGENTS.map(({ id, name, description }) => ({
    id,
    name,
    description,
  }));
}
