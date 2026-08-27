import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import type { Message } from "../types.js";
import type { AgentDefinition } from "./agent.types.js";
import { askOllamaChat } from "../services/ollama/ollama.service.js";

const ChatState = Annotation.Root({
  messages: Annotation<Message[]>,
  reply: Annotation<string>,
});

async function generate(
  state: typeof ChatState.State,
): Promise<Partial<typeof ChatState.State>> {
  const reply = await askOllamaChat(state.messages);
  return { reply };
}

const graph = new StateGraph(ChatState)
  .addNode("generate", generate)
  .addEdge(START, "generate")
  .addEdge("generate", END)
  .compile();

export const generalAssistantAgent: AgentDefinition = {
  id: "general-assistant",
  name: "General Assistant",
  description:
    "Plain chat, no document search — answers only from the model's own knowledge.",
  async invoke(messages) {
    const result = await graph.invoke({ messages });
    return result.reply;
  },
};
