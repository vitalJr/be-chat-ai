// This file is the EQUIVALENT of ollama.service.ts, but for the OpenAI API.
// It exists only for comparison/learning purposes — the application, by
// default, keeps using Ollama (see src/controllers/chat.controller.ts).
//
// Main differences compared to Ollama:
// 1) OpenAI is PAID and requires an API key (config.openaiApiKey)
// 2) The request body format uses "messages" (an array of role/content)
//    instead of a simple "prompt"
// 3) Parameter names change: max_tokens (not num_predict), and they all
//    live at the root level of the body (not inside an "options" object)
// 4) The response comes in data.choices[0].message.content (not data.response)

import { config } from "../config/env.js";

interface OpenAIChatResponse {
  choices: { message: { content: string } }[];
}

/**
 * Sends a message to OpenAI and returns the generated response.
 * @param prompt - The user's question/message
 */
export async function askOpenAI(prompt: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // OpenAI authenticates via the Authorization header, with "Bearer <your key>"
      Authorization: `Bearer ${config.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: config.openaiModel,
      // "messages" simulates a conversation: each item has who's speaking (role) and the text (content)
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 300,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Error calling OpenAI (status ${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as OpenAIChatResponse;

  // The response is "nested" inside choices[0].message.content
  return data.choices[0].message.content;
}
