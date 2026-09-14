import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import type { Message } from "../types.js";
import type { AgentDefinition } from "./agent.types.js";
import { askOllamaChat, rewriteQuery } from "../services/ollama/ollama.service.js";
import {
  searchRelevantChunks,
  buildContextFromChunks,
} from "../services/vectorstore/vectorstore.service.js";

const ChatState = Annotation.Root({
  messages: Annotation<Message[]>,
  userId: Annotation<string>,
  extraContext: Annotation<string | undefined>,
  reply: Annotation<string>,
});

async function retrieve(
  state: typeof ChatState.State,
): Promise<Partial<typeof ChatState.State>> {
  const lastMessage = state.messages[state.messages.length - 1];
  const history = state.messages.slice(0, -1);
  const searchQuery = await rewriteQuery(history, lastMessage.content);
  const relevantChunks = await searchRelevantChunks(searchQuery, state.userId);
  const extraContext = buildContextFromChunks(relevantChunks);

  return { extraContext };
}

async function generate(
  state: typeof ChatState.State,
): Promise<Partial<typeof ChatState.State>> {
  const reply = await askOllamaChat(state.messages, state.extraContext);
  return { reply };
}

const graph = new StateGraph(ChatState)
  .addNode("retrieve", retrieve)
  .addNode("generate", generate)
  .addEdge(START, "retrieve")
  .addEdge("retrieve", "generate")
  .addEdge("generate", END)
  .compile();

export const documentAssistantAgent: AgentDefinition = {
  id: "document-assistant",
  name: "Document Assistant",
  description:
    "Searches your uploaded documents for relevant context before answering (RAG). Falls back to plain chat when nothing relevant is found.",
  async invoke(messages, userId) {
    const result = await graph.invoke({ messages, userId });
    return result.reply;
  },
};
