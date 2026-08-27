import express from "express";
import type { ErrorRequestHandler } from "express";
import cors from "cors";
import { chatRouter } from "./routes/chat.routes.js";
import { documentRouter } from "./routes/document.routes.js";
import { agentRouter } from "./routes/agent.routes.js";
import { apiRateLimiter } from "./middlewares/rate-limit.middleware.js";

export const app = express();

app.use(cors());

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", apiRateLimiter);

app.use("/api", chatRouter);
app.use("/api", documentRouter);
app.use("/api", agentRouter);

const handleUploadError: ErrorRequestHandler = (err, req, res, next) => {
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
};
app.use(handleUploadError);
