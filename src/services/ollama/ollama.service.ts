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

export async function rewriteQuery(
  history: Message[],
  question: string,
): Promise<string> {
  if (history.length === 0) return question;

  const conversationText = history
    .map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.content}`)
    .join("\n");

  const prompt =
    "Given the conversation history below, rewrite the follow-up question " +
    "so it can be understood on its own, without needing the rest of the " +
    "conversation — resolve pronouns and implicit references (e.g. 'ele', " +
    "'isso', 'lá', 'it', 'that') using the history. Keep the same language " +
    "the question was written in. If the question already makes sense on " +
    "its own, return it unchanged. Reply with ONLY the rewritten question " +
    "— no explanation, no quotes.\n\n" +
    `Conversation:\n${conversationText}\n\n` +
    `Follow-up question: "${question}"\n\n` +
    "Rewritten question:";

  return askOllama(prompt);
}

export async function generateHypotheticalAnswer(
  question: string,
): Promise<string> {
  const prompt =
    "Write a short, plausible paragraph (2-4 sentences) that could answer " +
    "the question below, as if it were an excerpt from a real document. " +
    "It's completely fine — expected, even — to invent specific details " +
    "you don't actually know; this text is never shown to anyone, it's " +
    "only used to improve a search. Keep the same language the question " +
    "was written in. Reply with ONLY the hypothetical answer, no preamble.\n\n" +
    `Question: "${question}"\n\n` +
    "Hypothetical answer:";

  return askOllama(prompt);
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
