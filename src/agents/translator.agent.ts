import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import type { Message } from "../types.js";
import type { AgentDefinition } from "./agent.types.js";
import { askOllamaChat } from "../services/ollama/ollama.service.js";

const PERSONA_INSTRUCTIONS =
  "You are a translator. No matter what language the user writes in, or " +
  "what they ask, translate their exact message into English and reply, no extra comments. ";

const ChatState = Annotation.Root({
  messages: Annotation<Message[]>,
  reply: Annotation<string>,
});

async function generate(
  state: typeof ChatState.State,
): Promise<Partial<typeof ChatState.State>> {
  const reply = await askOllamaChat(state.messages, PERSONA_INSTRUCTIONS);
  return { reply };
}

const graph = new StateGraph(ChatState)
  .addNode("generate", generate)
  .addEdge(START, "generate")
  .addEdge("generate", END)
  .compile();

export const translatorAgent: AgentDefinition = {
  id: "translator",
  name: "Translator",
  description:
    "Translates whatever the user writes into English — ignores everything else the message might be asking for.",
  async invoke(messages) {
    const result = await graph.invoke({ messages });
    return result.reply;
  },
};
