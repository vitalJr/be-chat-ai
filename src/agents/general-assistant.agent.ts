import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import type { Message } from "../types.js";
import type { AgentDefinition } from "./agent.types.js";
import { buildToolCallingGraph } from "./tool-calling-graph.js";
import {
  searchRelevantChunks,
  buildContextFromChunks,
} from "../services/vectorstore/vectorstore.service.js";
import { webSearchAgent } from "./web-search.agent.js";
import { veterinaryAssistantAgent } from "./veterinary-assistant.agent.js";
import { translatorAgent } from "./translator.agent.js";

const SYSTEM_PROMPT =
  "You are a helpful assistant. You can answer question, provide information, and assist the user with a variaty f tasks. you have access to the following tools:\n\n" +
  "- search_documents: Search the user's uploaded documents for relevant information.\n" +
  "- web_search: Search the web for relevant information.\n" +
  "- translator: Translate any text into English.\n" +
  "- veterinary_assistant: Assist with veterinary-related questions.\n\n" +
  "When you respond, you must use the tools when appropriate. If the user " +
  "asks a question that can be answered by searching their uploaded documents, " +
  "use the search_documents tool. If the user asks a question that can be answered " +
  "by searching the web, use the web_search tool. If the user sends a message in a " +
  "language other than English, use the translator tool to translate it into English. Just translate the texte when its needed, if the user aske for it " +
  "If the user has a question about their pet's health, behavior, or care, use the " +
  "veterinary_assistant tool to provide assistance.\n\n" +
  "If you don't need to use a tool, respond with a plain text message.\n\n" +
  "When a tool returns an answer, use it exactly as given in your final " +
  "response — do not rephrase, summarize, or change it. In particular, " +
  "when you use the translator tool, your final response must be ONLY " +
  "the translated text it returns — no extra sentences, no explaining " +
  "what you translated.";

const searchDocumentsTool = tool(
  async ({ query }: { query: string }) => {
    const chunks = await searchRelevantChunks(query);
    return buildContextFromChunks(chunks) ?? "No relevant documents found.";
  },
  {
    name: "search_documents",
    description:
      "Search the user's uploaded documents for relevant information. " +
      "Use this whenever the question could be answered by something the " +
      "user uploaded.",
    schema: z.object({ query: z.string() }),
  },
);

const webSearchTool = tool(
  async ({ query }: { query: string }) => {
    const result = await webSearchAgent.invoke([
      { role: "user", content: query },
    ]);
    return result;
  },
  {
    name: "web_search",
    description:
      "Search the web for relevant information. Use this whenever the " +
      "question could be answered by something on the web.",
    schema: z.object({ query: z.string() }),
  },
);

const translatorAssisntantTool = tool(
  async ({ query }: { query: string }) => {
    const result = await translatorAgent.invoke([
      { role: "user", content: query },
    ]);
    return result;
  },
  {
    name: "translator",
    description:
      "Translate any text into English. Use this whenever the user sends a message in a language other than English.",
    schema: z.object({ query: z.string() }),
  },
);

const veterinaryAssistantTool = tool(
  async ({ query }: { query: string }) => {
    const result = await veterinaryAssistantAgent.invoke([
      { role: "user", content: query },
    ]);
    return result;
  },
  {
    name: "veterinary_assistant",
    description:
      "Assist with veterinary-related questions. Ask a specific question about the user's pet's health, behavior, or care. Use this whenever the user has a question about their pet's well-being.",
    schema: z.object({ query: z.string() }),
  },
);

function buildGraph() {
  return buildToolCallingGraph([
    searchDocumentsTool,
    webSearchTool,
    translatorAssisntantTool,
    veterinaryAssistantTool,
  ]);
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

export const generalAssistantAgent: AgentDefinition = {
  id: "general-assistant",
  name: "General Assistant",
  description:
    "Plain chat that decides on its own whether to search your uploaded " +
    "documents, search the web, or consult the veterinary-assistant.",
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
