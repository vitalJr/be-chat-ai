# AGENTS.md

Convention guide for anyone (human or AI agent) working on this project.
The goal is to keep the code consistent with what already exists — this
is a **learning** project, so pedagogical clarity matters as much as
technical correctness.

## Architecture

Fixed request flow: **route → controller → service → (config)**.

- `src/routes/*.routes.ts` — just wires a URL to a controller. No logic here.
- `src/controllers/*.controller.ts` — validates HTTP input, calls services,
  formats the response (`res.json`/`res.status`). Never talks to Ollama,
  the filesystem, or LangChain directly — always goes through a service.
- `src/services/*.service.ts` or `*.store.ts` — the actual business logic
  (calling Ollama, indexing documents, storing history). `*.store.ts` is
  used when the service is essentially a state repository (in-memory, for
  now).
- `src/config/*.ts` — centralizes env var and path reading. No
  `process.env.X` scattered through the rest of the code.
- `src/types.ts` — types shared across layers (e.g. `Message`).

When adding a new feature, follow this same chain — don't skip layers
(e.g. a controller calling `fetch` directly against Ollama).

## Modules and TypeScript

- Pure ESM (`"type": "module"`, `moduleResolution: "NodeNext"`). Imports
  **always** end in `.js`, even when importing a `.ts` file:
  ```ts
  import { config } from "../config/env.js";
  ```
- `strict: true` in tsconfig — don't weaken this.
- `import type { X } from ...` for types that don't exist at runtime
  (interfaces, Express/LangChain types used only in signatures).
- Run `npm run typecheck` before considering a change done — there's no
  build step in day-to-day use (`tsx` runs the `.ts` directly).

## Naming

- Controllers export `handleX` functions (`handleChat`, `handleUploadDocument`).
- Services export direct verbs (`askOllama`, `searchRelevantChunks`,
  `loadAndSplitDocument`), with no layer prefix.
- Files: `kebab-case` with a role suffix (`document-loader.service.ts`,
  `upload.middleware.ts`, `chat.routes.ts`).
- Private helper functions within a file are **not** exported.

## Error handling

- Controllers: `try/catch` around service calls; errors become
  `res.status(...).json({ error: err.message })`. End-user error messages
  stay in English (matching the rest of the app) and are specific
  enough to act on (e.g. telling the user to run `ollama serve`).
- Streaming (`handleChatStream`): you can't change the HTTP status once a
  chunk has already been sent — check `res.headersSent` before trying.
- Services that can fail "expectedly" (e.g. document indexing) shouldn't
  bring down the main flow — see `document.controller.ts`: the upload is
  still considered a success even if indexing fails, returning
  `indexed: false` + `indexError`.

## Comments

The codebase has **no comments** — every `.ts` file is comment-free by
design, code included. Don't add `//`, `/* */`, or JSDoc back in when
writing or editing code here, even to explain something non-obvious;
keep it in the PR description, commit message, or conversation instead.
Naming should carry as much of the "what" as possible on its own.

## In-memory state

`conversation.store.ts` and `vectorstore.service.ts` hold state in a
`Map`/object in process memory — **not** in a database. This is
intentional for the project's current stage (restarting the server wipes
everything). If real persistence is ever added, that's a deliberate
architecture change — don't bundle it with smaller unrelated changes.

## Configuration

Every environment variable is read **once** in `src/config/env.ts` and
exported as a typed object (`AppConfig`), with a default via `||` when it
makes sense to run without a `.env`. Never read `process.env` outside that
file.

## Available scripts

```bash
npm start          # run the API (tsx, no build)
npm run dev         # run with watch mode (restarts on file changes)
npm run build       # compile to dist/ with tsc (not needed for day-to-day dev)
npm run typecheck   # tsc --noEmit
npm run lint        # eslint .
npm test            # vitest run
```

Test coverage only reaches pure, dependency-free logic so far — no
mocking setup exists yet for Ollama's `fetch` calls, LangChain's loaders,
or Express request/response objects. Covered: `buildContextFromChunks`
(`vectorstore.service.test.ts`), `conversation.store.ts`'s in-memory
history operations, and `guessMimeType`
(`document-loader.service.test.ts`). Everything that touches Ollama, the
filesystem, or HTTP still relies on manual testing with `curl` (examples
in the README) against a local Ollama instance
(`ollama serve`). Add new `*.test.ts` files next to the code they cover
as coverage grows.

## What to avoid

- Don't introduce generic abstractions (DI containers, extra repository
  layers) beyond what already exists — the project is intentionally simple.
- Don't swap the in-memory `MemoryVectorStore`/`Map` for a real database
  "in passing" — that's an architecture decision, discuss it first.
- Don't add comments back into the code — see "Comments" above.
- Don't commit `.env`, `uploads/`, or `dist/` (already covered by
  `.gitignore`).
