// A persona-only agent: same single-node shape as general-assistant.ts
// (no RAG, no extra steps) — the only thing that differs is a fixed
// instruction handed to askOllamaChat via its "extraContext" parameter.
// That parameter is named after its original RAG use case
// (document-assistant.agent.ts uses it for retrieved chunks), but
// ollama.service.ts just treats it as "one more system message" — so
// it's equally valid for baking in a persona/task like this one.
import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import type { Message } from "../types.js";
import type { AgentDefinition } from "./agent.types.js";
import { askOllamaChat } from "../services/ollama/ollama.service.js";

const PERSONA_INSTRUCTIONS =
  "You are a translator. No matter what language the user writes in, or " +
  "what they ask, translate their exact message into English and reply " +
  "with ONLY the translation — no explanations, no extra commentary.";

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
