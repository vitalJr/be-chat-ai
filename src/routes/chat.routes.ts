import { Router } from "express";
import {
  handleChat,
  handleChatStream,
  handleClearChat,
  handleGetHistory,
} from "../controllers/chat.controller.js";
import { ollamaRateLimiter } from "../middlewares/rate-limit.middleware.js";
import { uploadAudio } from "../middlewares/audio-upload.middleware.js";

export const chatRouter = Router();

chatRouter.post(
  "/chat",
  ollamaRateLimiter,
  uploadAudio.single("audio"),
  handleChat,
);

chatRouter.post(
  "/chat/stream",
  ollamaRateLimiter,
  uploadAudio.single("audio"),
  handleChatStream,
);

chatRouter.delete("/chat", handleClearChat);

chatRouter.get("/chat/history", handleGetHistory);
