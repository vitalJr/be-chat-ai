import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { ChatOllama } from "@langchain/ollama";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { config } from "../config/env.js";

export function buildToolCallingGraph(tools: StructuredToolInterface[]) {
  const chatModel = new ChatOllama({
    model: config.ollamaToolModel,
    baseUrl: config.ollamaUrl,
    temperature: 0.3,
  }).bindTools(tools);

  async function generate(
    state: typeof MessagesAnnotation.State,
  ): Promise<Partial<typeof MessagesAnnotation.State>> {
    const response = await chatModel.invoke(state.messages);
    return { messages: [response] };
  }

  const toolNode = new ToolNode(tools);

  return new StateGraph(MessagesAnnotation)
    .addNode("generate", generate)
    .addNode("tools", toolNode)
    .addEdge(START, "generate")
    .addConditionalEdges("generate", toolsCondition, ["tools", END])
    .addEdge("tools", "generate")
    .compile();
}
