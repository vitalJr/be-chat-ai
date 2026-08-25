// "Routes" layer: defines WHICH URLs exist and which controller
// handles each one. No business logic here, just "wiring".

import { Router } from "express";
import {
  handleChat,
  handleChatStream,
  handleClearChat,
  handleGetHistory,
} from "../controllers/chat.controller.js";

export const chatRouter = Router();

// POST /api/chat  ->  body: { "message": "your question here" }
chatRouter.post("/chat", handleChat);

// POST /api/chat/stream  ->  same as /chat, but the response arrives in chunks
chatRouter.post("/chat/stream", handleChatStream);

// DELETE /api/chat  ->  clears the history and starts a new conversation
chatRouter.delete("/chat", handleClearChat);

// GET /api/chat/history  ->  debug: shows the history currently stored in memory
chatRouter.get("/chat/history", handleGetHistory);
