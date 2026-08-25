// "Service" layer: all the logic for talking to Ollama lives here.
// No other part of the code (controllers, routes) talks to Ollama
// directly — everyone goes through here. This makes it easier to
// understand and swap the AI later (e.g. replacing Ollama with another
// API) by touching a single place.

import { config } from "../config/env.js";
import type { Message } from "../types.js";

// Default system prompt: fixed instructions that apply to every
// conversation, sent along with every request (not part of the visible history).
const SYSTEM_PROMPT =
  "Always respond in the language the user used. Always respond as " +
  "clearly as possible and, when you're unsure about what the user is " +
  "asking, ask a clarifying question before answering. " +
  "When quoting back emails, usernames, codes, or any literal text " +
  "provided by the user, reproduce them EXACTLY as received, character " +
  "by character — never interpret '_' or '*' inside that text as " +
  "markdown formatting (italic/bold), and don't strip them.";

// Response shapes Ollama returns (only the fields we use)
interface OllamaGenerateResponse {
  response: string;
}

interface OllamaChatResponse {
  message: { content: string };
}

interface OllamaChatStreamChunk {
  message?: { content: string };
  done?: boolean;
}

// Builds the "system" messages that go at the start of every chat call:
// the fixed instructions + (if any) the context extracted from relevant
// documents, fetched by vectorstore.service.ts before reaching here.
function buildSystemMessages(extraContext?: string): Message[] {
  const systemMessages: Message[] = [{ role: "system", content: SYSTEM_PROMPT }];

  if (extraContext) {
    systemMessages.push({ role: "system", content: extraContext });
  }

  return systemMessages;
}

/**
 * Sends a message (prompt) to Ollama and returns the generated response.
 * @param prompt - The user's question/message
 */
export async function askOllama(prompt: string): Promise<string> {
  // Ollama exposes a local HTTP API at /api/generate
  const response = await fetch(`${config.ollamaUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.ollamaModel,
      prompt,
      system: SYSTEM_PROMPT,
      // Generation parameters go INSIDE "options" — outside of it, Ollama ignores them
      options: {
        temperature: 0.7,

        // num_predict: caps the MAXIMUM response length (in tokens).
        // Useful to avoid overly long responses and save time/tokens.
        // num_predict: 300,

        // num_ctx: the context window size (how much text the model can
        // "see" at once, including history + question). The default is
        // usually low (e.g. 2048); raising it helps with long
        // conversations, but uses more memory/processing.
        // num_ctx: 4096,

        // top_p: together with temperature, controls how "focused" the
        // model is when picking words (0.9 = only considers the most likely ones).
        // top_p: 0.9,

        // stop: list of strings that, if they appear, immediately stop
        // generation. Useful to prevent the model from "inventing" the
        // user's next question on its own.
        // stop: ["User:", "\n\n"],
      },

      // keep_alive: how long the model stays loaded in memory after
      // responding. Avoids the delay of reloading the model from scratch
      // on every new request. Accepts formats like "5m", "1h".
      // keep_alive: "5m",

      // stream: false makes Ollama return the full response at once,
      // instead of sending it piece by piece (simpler to start with)
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Error calling Ollama (status ${response.status}). Check that it's running with "ollama serve".`,
    );
  }

  const data = (await response.json()) as OllamaGenerateResponse;

  // Ollama returns several fields, but the response text is in "response"
  return data.response;
}

/**
 * Same as askOllama, but uses the /api/chat endpoint, which accepts a
 * message HISTORY instead of a single prompt. This is how the AI is able
 * to "remember" what was said earlier in the same conversation.
 * @param messages - the conversation's full history
 * @param extraContext - relevant document chunks (RAG), if any
 */
export async function askOllamaChat(messages: Message[], extraContext?: string): Promise<string> {
  const response = await fetch(`${config.ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.ollamaModel,
      // In /api/chat, "system" comes in as just another message at the
      // start of the list, instead of a separate field like in /api/generate
      messages: [...buildSystemMessages(extraContext), ...messages],
      options: {
        temperature: 0.7,

        // num_predict: caps the MAXIMUM response length (in tokens).
        // Useful to avoid overly long responses and save time/tokens.
        // num_predict: 300,

        // num_ctx: the context window size (how much text the model can
        // "see" at once, including history + question). The default is
        // usually low (e.g. 2048); raising it helps with long
        // conversations, but uses more memory/processing.
        // num_ctx: 4096,

        // top_p: together with temperature, controls how "focused" the
        // model is when picking words (0.9 = only considers the most likely ones).
        // top_p: 0.9,

        // stop: list of strings that, if they appear, immediately stop
        // generation. Useful to prevent the model from "inventing" the
        // user's next question on its own.
        // stop: ["User:", "\n\n"],
      },

      // keep_alive: how long the model stays loaded in memory after
      // responding. Avoids the delay of reloading the model from scratch
      // on every new request. Accepts formats like "5m", "1h".
      // keep_alive: "5m",

      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Error calling Ollama (status ${response.status}). Check that it's running with "ollama serve".`,
    );
  }

  const data = (await response.json()) as OllamaChatResponse;

  // In this endpoint the response comes inside message.content
  return data.message.content;
}

/**
 * Same as askOllamaChat, but in STREAMING mode: instead of waiting for
 * the full response, Ollama sends it piece by piece (one JSON line per
 * piece, a format called NDJSON). Each piece arrives at "onChunk", and
 * whoever called this function decides what to do with it (e.g. send it
 * to the browser right away).
 * @param messages - the conversation's full history
 * @param onChunk - called for every piece of text that arrives
 * @param extraContext - relevant document chunks (RAG), if any
 * @returns the full response text, once everything has arrived
 */
export async function askOllamaChatStream(
  messages: Message[],
  onChunk: (chunk: string) => void,
  extraContext?: string,
): Promise<string> {
  const response = await fetch(`${config.ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.ollamaModel,
      messages: [...buildSystemMessages(extraContext), ...messages],
      options: {
        temperature: 0.7,
      },
      // Here we DO want stream: true — that's what turns on chunked mode
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Error calling Ollama (status ${response.status}). Check that it's running with "ollama serve".`,
    );
  }

  if (!response.body) {
    throw new Error("Ollama's response didn't include a body to read in streaming mode.");
  }

  // response.body is a "reader" of bytes arriving gradually over the network
  const reader = response.body.getReader();
  const decoder = new TextDecoder(); // turns bytes into text
  let buffer = ""; // holds still-incomplete line fragments
  let fullText = ""; // accumulates the full response, to save to history afterward

  while (true) {
    const { done, value } = await reader.read();
    if (done) break; // no more pieces, response complete

    buffer += decoder.decode(value, { stream: true });

    // Ollama sends one JSON object per line; the buffer's last line might
    // be cut off mid-way, so we hold onto it for the next round
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;

      const parsed = JSON.parse(line) as OllamaChatStreamChunk;
      const piece = parsed.message?.content ?? "";

      if (piece) {
        fullText += piece;
        onChunk(piece);
      }
    }
  }

  return fullText;
}

/**
 * Asks the AI itself to summarize a chunk of conversation into a short
 * paragraph. Used to "compress" old history messages and save tokens on
 * future calls, without losing the important context.
 * @param messages - messages to summarize
 */
export async function summarizeConversation(messages: Message[]): Promise<string> {
  // Turns the message list into plain text, like a "transcript" of the conversation
  const conversationText = messages
    .map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.content}`)
    .join("\n");

  const summaryPrompt =
    "Summarize the conversation below in a single short paragraph, " +
    "keeping only the important facts and information (names, decisions, " +
    "preferences). Don't invent anything that isn't in the text.\n\n" +
    `Conversation:\n${conversationText}\n\nSummary:`;

  // Reuses askOllama, which already knows how to send a simple prompt and return text
  return askOllama(summaryPrompt);
}
