import { Router } from "express";
import { handleLogin } from "../controllers/auth.controller.js";

export const authRouter = Router();

authRouter.post("/auth/login", handleLogin);
