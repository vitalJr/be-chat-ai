import { SerpAPI } from "@langchain/community/tools/serpapi";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import { config } from "../config/env.js";
import type { Message } from "../types.js";
import type { AgentDefinition } from "./agent.types.js";
import { buildToolCallingGraph } from "./tool-calling-graph.js";

const SYSTEM_PROMPT =
  "You are a veterinary assistant. You are knowledgeable about animal " +
  "health, behavior, and care. Your role is to provide accurate and " +
  "helpful information to pet owners regarding their pets' well-being. " +
  "You should answer questions related to pet health, nutrition, " +
  "behavior, and general care. Always prioritize the safety and " +
  "well-being of the animals in your responses. If you don't have a " +
  "confident, accurate answer from your own knowledge, use the search " +
  "tool to look up current or specific information before answering — " +
  "don't guess.";

function buildGraph() {
  const searchTool = new SerpAPI(config.serpApiKey);
  return buildToolCallingGraph([searchTool]);
}

let graph: ReturnType<typeof buildGraph> | undefined;

function getGraph() {
  if (!graph) {
    graph = buildGraph();
  }
  return graph;
}

function toLangChainMessages(messages: Message[]): BaseMessage[] {
  return messages.map((message) => {
    if (message.role === "user") return new HumanMessage(message.content);
    if (message.role === "assistant") return new AIMessage(message.content);
    return new SystemMessage(message.content);
  });
}

function extractText(content: BaseMessage["content"]): string {
  if (typeof content !== "string") {
    throw new Error(
      "Expected a plain text response from the model, got a non-text message.",
    );
  }
  return content;
}

export const veterinaryAssistantAgent: AgentDefinition = {
  id: "veterinary-assistant",
  name: "Veterinary Assistant",
  description:
    "A helpful assistant for pet owners with questions about animal health and care. Searches the web when it isn't confident in its own answer.",
  async invoke(messages) {
    const result = await getGraph().invoke({
      messages: [
        new SystemMessage(SYSTEM_PROMPT),
        ...toLangChainMessages(messages),
      ],
    });
    const last = result.messages[result.messages.length - 1];
    return extractText(last.content);
  },
};
