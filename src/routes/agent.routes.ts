import { Router } from "express";
import { handleListAgents } from "../controllers/agent.controller.js";

export const agentRouter = Router();

agentRouter.get("/agents", handleListAgents);
