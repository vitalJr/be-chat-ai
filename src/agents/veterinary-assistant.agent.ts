import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { Message } from "../types.js";
import { askOllamaChat } from "../services/ollama/ollama.service.js";
import { AgentDefinition } from "./agent.types.js";

const PERSONA_INSTRUCTIONS_VETERINARY =
  "You are a veterinary assistant. You are knowledgeable about animal health, behavior, and care. Your role is to provide accurate and helpful information to pet owners regarding their pets' well-being. You should answer questions related to pet health, nutrition, behavior, and general care. Always prioritize the safety and well-being of the animals in your responses.";

const ChatState = Annotation.Root({
  messages: Annotation<Message[]>,
  reply: Annotation<string>,
});

async function generate(
  state: typeof ChatState.State,
): Promise<Partial<typeof ChatState.State>> {
  const reply = await askOllamaChat(
    state.messages,
    PERSONA_INSTRUCTIONS_VETERINARY,
  );
  return { reply };
}

const graph = new StateGraph(ChatState)
  .addNode("generate", generate)
  .addEdge(START, "generate")
  .addEdge("generate", END)
  .compile();

export const veterinaryAssistantAgent: AgentDefinition = {
  id: "veterinary-assistant",
  name: "Veterinary Assistant",
  description:
    "A helpful assistant for pet owners with questions about animal health and care.",
  async invoke(messages) {
    const result = await graph.invoke({ messages });
    return result.reply;
  },
};
