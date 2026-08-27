// "Routes" layer: defines WHICH URLs exist and which controller
// handles each one. No business logic here, just "wiring".

import { Router } from "express";
import {
  handleChat,
  handleChatStream,
  handleClearChat,
  handleGetHistory,
} from "../controllers/chat.controller.js";
import { ollamaRateLimiter } from "../middlewares/rate-limit.middleware.js";

export const chatRouter = Router();

// POST /api/chat  ->  body: { "message": "your question here" }
// ollamaRateLimiter here is stricter than the general one applied to all
// of /api in app.ts — this endpoint actually calls Ollama, so it gets its
// own tighter budget on top.
chatRouter.post("/chat", ollamaRateLimiter, handleChat);

// POST /api/chat/stream  ->  same as /chat, but the response arrives in chunks
chatRouter.post("/chat/stream", ollamaRateLimiter, handleChatStream);

// DELETE /api/chat  ->  clears the history and starts a new conversation
chatRouter.delete("/chat", handleClearChat);

// GET /api/chat/history  ->  debug: shows the history currently stored in memory
chatRouter.get("/chat/history", handleGetHistory);
