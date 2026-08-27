import { ChatOllama } from "@langchain/ollama";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import { config } from "../../config/env.js";
import type { Message } from "../../types.js";

const SYSTEM_PROMPT =
  "Always respond in the language the user used. Always respond as " +
  "clearly as possible and, when you're unsure about what the user is " +
  "asking, ask a clarifying question before answering. " +
  "When quoting back emails, usernames, codes, or any literal text " +
  "provided by the user, reproduce them EXACTLY as received, character " +
  "by character — never interpret '_' or '*' inside that text as " +
  "markdown formatting (italic/bold), and don't strip them.";

const chatModel = new ChatOllama({
  model: config.ollamaModel,
  baseUrl: config.ollamaUrl,
  temperature: 0.3,
  numPredict: config.ollamaMaxTokens,
  numCtx: config.ollamaMaxContext,
});

function toLangChainMessages(messages: Message[]): BaseMessage[] {
  return messages.map((message) => {
    if (message.role === "user") return new HumanMessage(message.content);
    if (message.role === "assistant") return new AIMessage(message.content);
    return new SystemMessage(message.content);
  });
}

function buildSystemMessages(extraContext?: string): BaseMessage[] {
  const systemMessages: BaseMessage[] = [new SystemMessage(SYSTEM_PROMPT)];

  if (extraContext) {
    systemMessages.push(new SystemMessage(extraContext));
  }

  return systemMessages;
}

function extractText(content: AIMessage["content"]): string {
  if (typeof content !== "string") {
    throw new Error(
      "Expected a plain text response from the model, got a non-text message.",
    );
  }
  return content;
}

export async function askOllama(prompt: string): Promise<string> {
  const result = await chatModel.invoke([
    new SystemMessage(SYSTEM_PROMPT),
    new HumanMessage(prompt),
  ]);
  return extractText(result.content);
}

export async function askOllamaChat(
  messages: Message[],
  extraContext?: string,
): Promise<string> {
  const result = await chatModel.invoke([
    ...buildSystemMessages(extraContext),
    ...toLangChainMessages(messages),
  ]);
  return extractText(result.content);
}

export async function askOllamaChatStream(
  messages: Message[],
  onChunk: (chunk: string) => void,
  extraContext?: string,
): Promise<string> {
  const stream = await chatModel.stream([
    ...buildSystemMessages(extraContext),
    ...toLangChainMessages(messages),
  ]);

  let fullText = "";

  for await (const chunk of stream) {
    const piece = extractText(chunk.content);

    if (piece) {
      fullText += piece;
      onChunk(piece);
    }
  }

  return fullText;
}

export async function summarizeConversation(
  messages: Message[],
): Promise<string> {
  const conversationText = messages
    .map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.content}`)
    .join("\n");

  const summaryPrompt =
    "Summarize the conversation below in a single short paragraph, " +
    "keeping only the important facts and information (names, decisions, " +
    "preferences). Don't invent anything that isn't in the text.\n\n" +
    `Conversation:\n${conversationText}\n\nSummary:`;

  return askOllama(summaryPrompt);
}
