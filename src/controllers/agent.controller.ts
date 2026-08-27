import type { Request, Response } from "express";
import { listAgents } from "../services/agent-registry.js";

export function handleListAgents(req: Request, res: Response) {
  return res.json({ agents: listAgents() });
}
