// "Routes" layer: defines the URL for discovering available agents.
import { Router } from "express";
import { handleListAgents } from "../controllers/agent.controller.js";

export const agentRouter = Router();

// GET /api/agents -> lists every agent selectable via ?agentId=... on the chat endpoints
agentRouter.get("/agents", handleListAgents);
