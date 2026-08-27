import { config } from "../../config/env.js";

interface OpenAIChatResponse {
  choices: { message: { content: string } }[];
}

export async function askOpenAI(prompt: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: config.openaiModel,
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

  return data.choices[0].message.content;
}
