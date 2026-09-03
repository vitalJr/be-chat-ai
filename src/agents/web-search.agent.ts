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
  "You can search the web with the available tool whenever you need. " +
  "If you have some question about the user input, ask a clarifying question before answering. " +
  "Always respond in the language the user used. Always respond as clearly as possible. " +
  "When quoting back emails, usernames, codes, or any literal text provided by the user, " +
  "reproduce them EXACTLY as received, character by character — never interpret '_' or '*' inside that text as markdown formatting (italic/bold), and don't strip them.";

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

export const webSearchAgent: AgentDefinition = {
  id: "web-search",
  name: "Web Search Assistant",
  description:
    "Searches the web (SerpAPI) when it needs current or specific information to answer.",
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
