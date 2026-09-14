import { tool } from "@langchain/core/tools";
import type { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
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

const NO_RESULT_MESSAGE = "Não encontrei uma resposta para isso.";

const SYSTEM_PROMPT =
  "You are a helpful assistant. You can answer question, provide information, and assist the user with a variaty f tasks. you have access to the following tools:\n\n" +
  "- search_documents: Search the user's uploaded documents for relevant information.\n" +
  "- web_search: Search the web for relevant information.\n" +
  "- translator: Translate a piece of text into English.\n" +
  "- veterinary_assistant: Assist with veterinary-related questions.\n\n" +
  "When you respond, you must use the tools when appropriate. If the user " +
  "asks a question that can be answered by searching their uploaded documents, " +
  "use the search_documents tool. If the user asks a question that can be answered " +
  "by searching the web, use the web_search tool. Respond directly in whatever " +
  "language the user writes in — you understand many languages, so do NOT use " +
  "the translator tool just because a message isn't in English. Only use the " +
  "translator tool when the user explicitly asks you to translate something. " +
  "If the user has a question about their pet's health, behavior, or care, use the " +
  "veterinary_assistant tool to provide assistance.\n\n" +
  "If you don't need to use a tool, respond with a plain text message.\n\n" +
  "When a tool returns an answer, use it exactly as given in your final " +
  "response — do not rephrase, summarize, or change it. In particular, " +
  "when you use the translator tool, your final response must be ONLY " +
  "the translated text it returns — no extra sentences, no explaining " +
  "what you translated.\n\n" +
  "If none of the tools you used returned anything useful, and you don't " +
  `genuinely know the answer yourself, reply with EXACTLY this text: "` +
  NO_RESULT_MESSAGE +
  '" — nothing else, no explanation, no apology.';

const searchDocumentsTool = tool(
  async ({ query }: { query: string }, config: RunnableConfig) => {
    console.log("searchDocumentsTool");
    const userId = config.configurable?.userId as string;
    const chunks = await searchRelevantChunks(query, userId);
    return buildContextFromChunks(chunks) ?? NO_RESULT_MESSAGE;
  },
  {
    name: "search_documents",
    description:
      "Use when the user need to search some information in their uploaded documents. Do NOT use this when the user needs to search the web — use web_search for that instead.",
    schema: z.object({ query: z.string() }),
  },
);

const webSearchTool = tool(
  async ({ query }: { query: string }, config: RunnableConfig) => {
    console.log("webSearchTool");
    const userId = config.configurable?.userId as string;
    const result = await webSearchAgent.invoke(
      [{ role: "user", content: query }],
      userId,
    );
    console.log("webSearchTool result:", result);
    return result;
  },
  {
    name: "web_search",
    description:
      "Search the web for current or general information. Do NOT use " +
      "this when the user refers to a document they sent/uploaded — use " +
      "search_documents for that instead.",
    schema: z.object({ query: z.string() }),
  },
);

const translatorAssisntantTool = tool(
  async ({ query }: { query: string }, config: RunnableConfig) => {
    console.log("translatorAssisntantTool");
    const userId = config.configurable?.userId as string;
    const result = await translatorAgent.invoke(
      [{ role: "user", content: query }],
      userId,
    );
    return result;
  },
  {
    name: "translator",
    description:
      "Translate a piece of text into English. Use this ONLY when the " +
      "user explicitly asks you to translate something — never just " +
      "because their own message happens to be in another language.",
    schema: z.object({ query: z.string() }),
  },
);

const veterinaryAssistantTool = tool(
  async ({ query }: { query: string }, config: RunnableConfig) => {
    console.log("veterinaryAssistantTool");
    const userId = config.configurable?.userId as string;
    const result = await veterinaryAssistantAgent.invoke(
      [{ role: "user", content: query }],
      userId,
    );
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

function findFinalToolMessage(messages: BaseMessage[]): ToolMessage | undefined {
  const last = messages[messages.length - 1];
  if (!(last instanceof AIMessage)) return undefined;

  const beforeLast = messages[messages.length - 2];
  return beforeLast instanceof ToolMessage ? beforeLast : undefined;
}

function isNoResultMessage(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return normalized.length === 0 || normalized === NO_RESULT_MESSAGE.toLowerCase();
}

export const generalAssistantAgent: AgentDefinition = {
  id: "general-assistant",
  name: "General Assistant",
  description:
    "A general-purpose assistant that can answer questions, provide information, and assist with a variety of tasks. It can search the user's uploaded documents, search the web, translate text, and provide veterinary assistance.",
  async invoke(messages, userId) {
    const result = await getGraph().invoke(
      {
        messages: [
          new SystemMessage(SYSTEM_PROMPT),
          ...toLangChainMessages(messages),
        ],
      },
      { configurable: { userId } },
    );
    console.log("generalAssistantAgent result:", result);
    const last = result.messages[result.messages.length - 1];
    const aiText = extractText(last.content);

    if (!isNoResultMessage(aiText)) {
      return aiText;
    }

    const finalToolMessage = findFinalToolMessage(result.messages);
    const toolText = finalToolMessage
      ? extractText(finalToolMessage.content)
      : undefined;

    if (toolText && !isNoResultMessage(toolText)) {
      return toolText;
    }

    return NO_RESULT_MESSAGE;
  },
};
