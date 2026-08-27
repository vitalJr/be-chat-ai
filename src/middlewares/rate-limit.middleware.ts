// Limits how many requests a single IP can make in a time window, so one
// client can't hammer the API by sending requests in a tight loop — and,
// for the endpoints that call Ollama, can't burn through your local
// model's capacity (or a paid API's quota, if you're using openai.service.ts).
import { rateLimit } from "express-rate-limit";

// Applies to every /api/* route (see app.ts). Generous on purpose — its
// job is just to stop runaway loops/scripts, not to police normal usage.
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100,
  standardHeaders: true, // adds RateLimit-* response headers so clients can see their quota
  legacyHeaders: false, // skip the older X-RateLimit-* headers, standardHeaders already covers this
  message: { error: "Too many requests. Please try again later." },
});

// Stricter limit for the endpoints that actually call Ollama (chat and
// document upload/indexing) — each of those is slow and resource-heavy,
// so they get their own tighter budget on top of the general one above.
export const ollamaRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many AI requests. Please slow down and try again in a few minutes.",
  },
});
