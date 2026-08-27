// This file assembles the Express application: configures middlewares
// (things that run on every request) and wires up the routes.
// It does NOT start the server (never calls .listen) — index.ts does that.
// Separating "assembling the app" from "starting the server" makes it
// easier, for example, to write automated tests later without opening a real port.

import express from "express";
import type { ErrorRequestHandler } from "express";
import cors from "cors";
import { chatRouter } from "./routes/chat.routes.js";
import { documentRouter } from "./routes/document.routes.js";
import { agentRouter } from "./routes/agent.routes.js";
import { apiRateLimiter } from "./middlewares/rate-limit.middleware.js";

export const app = express();

// Without this, the browser blocks calls coming from a different
// port/origin (e.g. a frontend running on localhost:3001). Since this is
// a learning/local-only project, we allow any origin — in production the
// ideal would be to restrict this to the exact frontend domain.
app.use(cors());

// Middleware that lets Express understand JSON in the request body
app.use(express.json());

// Simple route just to check whether the server is up
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Caps how many requests a single IP can make to any /api/* route in a
// time window (see rate-limit.middleware.ts). Placed before the routers
// so it runs on every request under /api, regardless of which one.
app.use("/api", apiRateLimiter);

// All chat routes are grouped under the /api prefix
app.use("/api", chatRouter);
app.use("/api", documentRouter);
app.use("/api", agentRouter);

// Error middleware: catches upload problems (invalid file type, file too
// large) and returns a proper JSON response instead of Express throwing a
// generic error. Needs to come LAST and have exactly 4 parameters — that's
// how Express recognizes this function as an error handler.
const handleUploadError: ErrorRequestHandler = (err, req, res, next) => {
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
};
app.use(handleUploadError);
