// This file defines a LangGraph orchestration for a single chat turn.
// Instead of the controller calling searchRelevantChunks() and then
// askOllamaChat() by hand — an imperative sequence with the control flow
// hidden inside the function body — we describe the same two steps as an
// explicit GRAPH: a set of NODES (units of work) connected by EDGES (the
// order they run in). LangGraph then runs that graph for us.
//
// For this first version the graph is a straight line — retrieve, then
// generate — so the behavior is IDENTICAL to what chat.controller.ts used
// to do by hand. The point of this step isn't a behavior change: it's
// having an explicit state machine that can later grow a conditional
// branch (e.g. skip retrieval when the question clearly doesn't need it)
// without having to rewrite the controller again.

import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import type { Message } from "../types.js";
import { askOllamaChat } from "./ollama/ollama.service.js";
import {
  searchRelevantChunks,
  buildContextFromChunks,
} from "./vectorstore/vectorstore.service.js";

// The graph's "state" is the data that flows between nodes. Each node
// receives the current state and returns a PARTIAL state — only the
// field(s) it changed. LangGraph merges that back into the full state
// before handing it to the next node. This is different from a plain
// chain of function calls: every node only needs to know the shape of
// the state, not which node ran before it or what it did.
const ChatState = Annotation.Root({
  // Input: the conversation's full history, already including the
  // user's latest message (the controller adds it before invoking the graph)
  messages: Annotation<Message[]>,
  // Set by the "retrieve" node: relevant document excerpts, if any
  extraContext: Annotation<string | undefined>,
  // Set by the "generate" node: the AI's final answer
  reply: Annotation<string>,
});

// NODE 1: "retrieve" — the same job searchRelevantChunks +
// buildContextFromChunks used to do inline inside the controller. Looks
// at the last message (the user's question) and searches the vector
// store for relevant chunks.
async function retrieve(
  state: typeof ChatState.State,
): Promise<Partial<typeof ChatState.State>> {
  const lastMessage = state.messages[state.messages.length - 1];
  const relevantChunks = await searchRelevantChunks(lastMessage.content);
  const extraContext = buildContextFromChunks(relevantChunks);

  // Returning only "extraContext" here — LangGraph merges this into the
  // existing state, it doesn't wipe out "messages" or "reply"
  return { extraContext };
}

// NODE 2: "generate" — sends the history + extra context to Ollama, the
// same call askOllamaChat() the controller used to make directly.
async function generate(
  state: typeof ChatState.State,
): Promise<Partial<typeof ChatState.State>> {
  const reply = await askOllamaChat(state.messages, state.extraContext);
  return { reply };
}

// Wires the nodes together: START -> retrieve -> generate -> END.
// .compile() turns this description into something that can actually be
// run with .invoke(). We compile once here, at module load, and reuse
// the same compiled graph on every request instead of rebuilding it each time.
export const chatGraph = new StateGraph(ChatState)
  .addNode("retrieve", retrieve)
  .addNode("generate", generate)
  .addEdge(START, "retrieve")
  .addEdge("retrieve", "generate")
  .addEdge("generate", END)
  .compile();
