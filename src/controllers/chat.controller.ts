import type { Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import {
  askOllamaChatStream,
  summarizeConversation,
} from "../services/ollama/ollama.service.js";
import {
  getHistory,
  addMessage,
  clearHistory,
  setHistory,
} from "../services/conversation/conversation.store.js";
import {
  searchRelevantChunks,
  buildContextFromChunks,
} from "../services/vectorstore/vectorstore.service.js";
import { DEFAULT_AGENT_ID, getAgent } from "../services/agent-registry.js";
import { transcribeAudio } from "../services/speech/speech-to-text.service.js";

const MAX_MESSAGES_BEFORE_SUMMARY = 10;
const RECENT_MESSAGES_TO_KEEP = 4;

const DEFAULT_CONVERSATION_ID = "default";

interface ChatRequestBody {
  message?: string;
}

function resolveConversationId(req: { query: Record<string, unknown> }): string {
  const raw = req.query.conversationId;

  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw;
  }

  return DEFAULT_CONVERSATION_ID;
}

function resolveAgentId(req: { query: Record<string, unknown> }): string {
  const raw = req.query.agentId;

  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw;
  }

  return DEFAULT_AGENT_ID;
}

type ResolvedMessage = { message: string } | { error: string };

async function resolveIncomingMessage(
  req: AuthenticatedRequest<{}, {}, ChatRequestBody>,
): Promise<ResolvedMessage> {
  if (req.file) {
    try {
      const transcribed = await transcribeAudio(req.file.buffer);

      if (!transcribed || transcribed.trim().length === 0) {
        return { error: "Could not transcribe any speech from the audio sent." };
      }

      return { message: transcribed };
    } catch (error) {
      const err = error as Error;
      return { error: `Error transcribing audio: ${err.message}` };
    }
  }

  const { message } = req.body;
  if (message && typeof message === "string") {
    return { message };
  }

  return {
    error:
      'Please send a "message" field (text) or an "audio" file (form-data) in the request.',
  };
}

export async function handleChat(
  req: AuthenticatedRequest<{}, {}, ChatRequestBody>,
  res: Response,
) {
  const userId = req.user!.id;
  const conversationId = resolveConversationId(req);
  const agentId = resolveAgentId(req);

  const resolved = await resolveIncomingMessage(req);
  if ("error" in resolved) {
    return res.status(400).json({ error: resolved.error });
  }
  const { message } = resolved;

  const agent = getAgent(agentId);
  if (!agent) {
    return res.status(400).json({
      error: `Unknown agentId "${agentId}". See GET /api/agents for the available options.`,
    });
  }
  try {
    addMessage(userId, conversationId, "user", message);

    const reply = await agent.invoke(getHistory(userId, conversationId), userId);

    addMessage(userId, conversationId, "assistant", reply);

    await summarizeHistoryIfNeeded(userId, conversationId);

    return res.json({ reply, conversationId, agentId: agent.id, message });
  } catch (error) {
    const err = error as Error;
    console.error("Error querying Ollama:", err.message);
    return res.status(500).json({ error: err.message });
  }
}

export async function handleChatStream(
  req: AuthenticatedRequest<{}, {}, ChatRequestBody>,
  res: Response,
) {
  const userId = req.user!.id;
  const conversationId = resolveConversationId(req);

  const resolved = await resolveIncomingMessage(req);
  if ("error" in resolved) {
    return res.status(400).json({ error: resolved.error });
  }
  const { message } = resolved;

  addMessage(userId, conversationId, "user", message);

  res.setHeader("Content-Type", "text/plain; charset=utf-8");

  try {
    const relevantChunks = await searchRelevantChunks(message, userId);
    const extraContext = buildContextFromChunks(relevantChunks);

    const fullReply = await askOllamaChatStream(
      getHistory(userId, conversationId),
      (chunk) => {
        res.write(chunk);
      },
      extraContext,
    );

    addMessage(userId, conversationId, "assistant", fullReply);
    await summarizeHistoryIfNeeded(userId, conversationId);

    res.end();
  } catch (error) {
    const err = error as Error;
    console.error("Error querying Ollama (stream):", err.message);

    if (!res.headersSent) {
      res.status(500);
    }
    res.end(`\n[error: ${err.message}]`);
  }
}

async function summarizeHistoryIfNeeded(
  userId: string,
  conversationId: string,
): Promise<void> {
  const history = getHistory(userId, conversationId);

  if (history.length <= MAX_MESSAGES_BEFORE_SUMMARY) {
    return;
  }

  const oldMessages = history.slice(
    0,
    history.length - RECENT_MESSAGES_TO_KEEP,
  );
  const recentMessages = history.slice(
    history.length - RECENT_MESSAGES_TO_KEEP,
  );

  const summary = await summarizeConversation(oldMessages);

  setHistory(userId, conversationId, [
    {
      role: "system",
      content: `Summary of the conversation so far: ${summary}`,
    },
    ...recentMessages,
  ]);
}

export function handleClearChat(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;
  const conversationId = resolveConversationId(req);
  clearHistory(userId, conversationId);
  return res.json({ status: "history cleared", conversationId });
}

export function handleGetHistory(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;
  const conversationId = resolveConversationId(req);
  return res.json({ conversationId, history: getHistory(userId, conversationId) });
}
