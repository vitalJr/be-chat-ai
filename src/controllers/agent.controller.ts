// "Controller" layer: exposes what's in the agent registry over HTTP.
import type { Request, Response } from "express";
import { listAgents } from "../services/agent-registry.js";

// GET /api/agents -> { agents: [{ id, name, description }, ...] }
// Lets clients discover which ?agentId=... values POST /api/chat accepts.
export function handleListAgents(req: Request, res: Response) {
  return res.json({ agents: listAgents() });
}
