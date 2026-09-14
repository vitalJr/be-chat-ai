import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import type { Message } from "../types.js";
import type { AgentDefinition } from "./agent.types.js";
import {
  askOllama,
  askOllamaChat,
  rewriteQuery,
} from "../services/ollama/ollama.service.js";
import {
  searchRelevantChunks,
  buildContextFromChunks,
} from "../services/vectorstore/vectorstore.service.js";

const RouterState = Annotation.Root({
  messages: Annotation<Message[]>,
  userId: Annotation<string>,
  extraContext: Annotation<string | undefined>,
  route: Annotation<"rag" | "chat">,
  reply: Annotation<string>,
});

const ragSubgraph = new StateGraph(RouterState)
  .addNode("retrieve", async (state) => {
    console.log("entrou aqui 2");
    const lastMessage = state.messages[state.messages.length - 1];
    const history = state.messages.slice(0, -1);
    const searchQuery = await rewriteQuery(history, lastMessage.content);
    const chunks = await searchRelevantChunks(searchQuery, state.userId);
    return { extraContext: buildContextFromChunks(chunks) };
  })
  .addNode("generate", async (state) => {
    const reply = await askOllamaChat(state.messages, state.extraContext);
    return { reply };
  })
  .addEdge(START, "retrieve")
  .addEdge("retrieve", "generate")
  .addEdge("generate", END)
  .compile();

const chatSubgraph = new StateGraph(RouterState)
  .addNode("generate", async (state) => {
    console.log("entrou aqui 3");
    const reply = await askOllamaChat(state.messages);
    return { reply };
  })
  .addEdge(START, "generate")
  .addEdge("generate", END)
  .compile();

async function classify(
  state: typeof RouterState.State,
): Promise<Partial<typeof RouterState.State>> {
  const lastMessage = state.messages[state.messages.length - 1];
  const answer = await askOllama(
    'Classify the question below as "rag" or "chat".\n\n' +
      '"rag" = the question asks about specific content from a personal ' +
      "document the user uploaded (a résumé/CV, a named person's work " +
      "history, a report) — information that only exists in that " +
      "document, not general knowledge.\n" +
      '"chat" = a general-knowledge question anyone could answer without ' +
      "reading any specific uploaded document.\n\n" +
      "Examples:\n" +
      '"What does my resume say about my education?" -> rag\n' +
      '"What is the capital of France?" -> chat\n' +
      '"How does photosynthesis work?" -> chat\n' +
      '"What companies has Vital worked at?" -> rag\n\n' +
      `Question: "${lastMessage.content}"\n\n` +
      'Reply with exactly one word: "rag" or "chat". Nothing else.',
  );
  const route = answer.toLowerCase().includes("rag") ? "rag" : "chat";
  return { route };
}

const graph = new StateGraph(RouterState)
  .addNode("classify", classify)
  .addNode("rag", ragSubgraph)
  .addNode("chat", chatSubgraph)
  .addEdge(START, "classify")
  .addConditionalEdges("classify", (state) => state.route, {
    rag: "rag",
    chat: "chat",
  })
  .addEdge("rag", END)
  .addEdge("chat", END)
  .compile();

export const routerAssistantAgent: AgentDefinition = {
  id: "router-assistant",
  name: "Router Assistant",
  description:
    "Demonstrates real LangGraph subgraph composition: a classify node " +
    "routes to one of two compiled subgraphs (RAG or plain chat) that " +
    "share the same graph state — routing decided by code " +
    "(addConditionalEdges), not by the model choosing a tool.",
  async invoke(messages, userId) {
    console.log("entrou aqui 1");
    const result = await graph.invoke({ messages, userId });
    return result.reply;
  },
};
