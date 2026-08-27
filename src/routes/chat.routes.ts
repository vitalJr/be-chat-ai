import { Router } from "express";
import {
  handleChat,
  handleChatStream,
  handleClearChat,
  handleGetHistory,
} from "../controllers/chat.controller.js";
import { ollamaRateLimiter } from "../middlewares/rate-limit.middleware.js";

export const chatRouter = Router();

chatRouter.post("/chat", ollamaRateLimiter, handleChat);

chatRouter.post("/chat/stream", ollamaRateLimiter, handleChatStream);

chatRouter.delete("/chat", handleClearChat);

chatRouter.get("/chat/history", handleGetHistory);
