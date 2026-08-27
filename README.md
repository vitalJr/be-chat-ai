# Ollama Chat API

Node.js + TypeScript + Express API that sends messages to an AI running
locally via [Ollama](https://ollama.com) (100% free, no paid account
needed), with support for multiple interchangeable **agents**, RAG over
your own documents, and rate limiting.

See [AGENTS.md](./AGENTS.md) for the project's architecture and coding
conventions, if you're contributing.

## Folder structure

```
ollama-chat-api/
├── index.ts                        # Entry point: reindexes uploaded docs, then starts the server
├── tsconfig.json                   # TypeScript configuration
├── src/
│   ├── app.ts                      # Assembles Express (middlewares + routes)
│   ├── types.ts                    # Shared types (e.g. Message)
│   ├── config/
│   │   ├── env.ts                  # Reads environment variables (.env)
│   │   └── uploads.ts              # Where uploaded files are stored
│   ├── routes/
│   │   ├── chat.routes.ts          # Chat URLs
│   │   ├── document.routes.ts      # Document upload URLs
│   │   └── agent.routes.ts         # GET /api/agents
│   ├── controllers/
│   │   ├── chat.controller.ts      # Receives the chat request, picks the agent, validates data
│   │   ├── document.controller.ts  # Receives the upload request
│   │   └── agent.controller.ts     # Lists available agents
│   ├── middlewares/
│   │   ├── upload.middleware.ts    # Configures multer (file validation/saving)
│   │   └── rate-limit.middleware.ts # Caps requests per IP
│   ├── agents/                     # One file per agent — see "Agents" below
│   │   ├── agent.types.ts          # The AgentDefinition contract every agent implements
│   │   ├── tool-calling-graph.ts   # Shared generate<->tools loop, reused by any agent that needs tools
│   │   ├── document-assistant.agent.ts  # RAG: searches your documents before answering
│   │   ├── general-assistant.agent.ts   # Plain chat, no document search
│   │   ├── translator.agent.ts          # Persona-only agent: always replies in English
│   │   ├── veterinary-assistant.agent.ts # Pet health & care, searches the web as a fallback
│   │   └── web-search.agent.ts          # Searches the web (SerpAPI) when it needs to
│   └── services/
│       ├── agent-registry.ts       # Catalog of every registered agent
│       ├── ollama/
│       │   └── ollama.service.ts       # Talks to Ollama (via LangChain's ChatOllama)
│       ├── ai/
│       │   └── openai.service.ts       # Equivalent example using OpenAI (paid)
│       ├── conversation/
│       │   └── conversation.store.ts   # Stores conversation history in memory
│       ├── document/
│       │   ├── document.store.ts           # Lists saved documents; reindexes them on startup
│       │   └── document-loader.service.ts  # Extracts text from PDF/DOC/DOCX and splits it into chunks
│       └── vectorstore/
│           └── vectorstore.service.ts  # Semantic search index (RAG) with LangChain
├── uploads/                        # Where uploaded files are saved
```

A request always flows as: **route → controller → agent/service**.

## How to run

1. Install the dependencies:
   ```bash
   npm install
   ```

2. Copy the example environment variables file:
   ```bash
   cp .env.example .env
   ```

3. Make sure Ollama is running and you have the models pulled (the
   configured defaults are `llama3` for chat and `nomic-embed-text` for
   document search):
   ```bash
   ollama pull llama3
   ollama pull nomic-embed-text
   ollama serve
   ```

4. Start the API (runs the TypeScript directly, no build needed):
   ```bash
   npm start
   ```
   During development, use `npm run dev` instead — it restarts
   automatically on every file change.

5. Test it with curl (in another terminal):
   ```bash
   curl -X POST http://localhost:3000/api/chat \
     -H "Content-Type: application/json" \
     -d '{"message": "Explain what Node.js is in one sentence"}'
   ```

   Expected response:
   ```json
   { "reply": "Node.js is a runtime environment...", "conversationId": "default", "agentId": "document-assistant" }
   ```

## Other endpoints

- `POST /api/chat/stream` — same as `/api/chat`, but the response arrives
  in chunks as the AI generates it (use `curl -N` to see the effect).
  Always uses the `document-assistant` agent's RAG behavior — not
  agent-selectable yet (see "Agents" below).
- `DELETE /api/chat` — clears the conversation history
- `GET /api/chat/history` — shows the history stored in memory (debug)
- `GET /api/agents` — lists every available agent
- `GET /health` — checks whether the server is up

Requests beyond the configured rate limit get a `429` response (see
"Rate limiting" below).

## Agents

`POST /api/chat` accepts an optional `?agentId=...` parameter to choose
which agent answers the message. Every agent implements the same
contract (`invoke(messages) -> reply`, see `src/agents/agent.types.ts`),
but what happens inside can differ completely — a different graph
(with or without document search), a fixed persona, or anything else a
future agent adds.

See what's available:
```bash
curl http://localhost:3000/api/agents
```

Currently registered:

| `agentId` | What it does |
|---|---|
| `document-assistant` (default) | Searches your uploaded documents for relevant context before answering (RAG). Falls back to plain chat when nothing relevant is found. |
| `general-assistant` | Plain chat, no document search — answers only from the model's own knowledge. |
| `translator` | Translates whatever you write into English, ignoring everything else the message asks for. |
| `veterinary-assistant` | Answers questions about pet health, nutrition, behavior, and care. Searches the web when it isn't confident in its own answer. |
| `web-search` | Searches the web (SerpAPI) when it needs current or specific information to answer. |

Example:
```bash
curl -X POST "http://localhost:3000/api/chat?agentId=general-assistant" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hi there"}'
```

If you don't send `agentId`, you get `document-assistant` — identical to
the behavior before agents existed. An unknown `agentId` returns `400`.

**Adding a new agent**: create a file in `src/agents/` exporting an
`AgentDefinition`, then list it in `REGISTERED_AGENTS` in
`src/services/agent-registry.ts`. Nothing else needs to change.

## Tool calling (web search)

`web-search` and `veterinary-assistant` can call a real tool — a web
search via [SerpAPI](https://serpapi.com) — instead of only answering
from what the model already knows. The model itself decides, per
message, whether it needs to search or can answer directly; there's no
code forcing the tool to run.

This needs two things `.env` doesn't set by default:

- **`OLLAMA_TOOL_MODEL`** — the plain `OLLAMA_MODEL` (`llama3` by
  default) doesn't reliably support tool calling. Pull a model that does
  (e.g. `ollama pull llama3.2`) and set `OLLAMA_TOOL_MODEL=llama3.2`.
- **`SERPAPI_API_KEY`** — free tier available at
  [serpapi.com](https://serpapi.com), key at
  [serpapi.com/manage-api-key](https://serpapi.com/manage-api-key).
  Without it, these two agents return an error when called; every other
  agent keeps working normally.

The tool-calling loop itself (ask the model → run the tool if it asked
for one → ask again with the result → repeat until it answers) lives
once in `src/agents/tool-calling-graph.ts`, as `buildToolCallingGraph(tools)`.
Any agent that needs tools calls this with its own list of tools instead
of reimplementing the loop.

## Multiple conversations

Every chat endpoint accepts an optional `?conversationId=...` parameter in
the URL, to keep conversations separate (e.g. several browser tabs,
different users):

```bash
curl -X POST "http://localhost:3000/api/chat?conversationId=ana" \
  -H "Content-Type: application/json" \
  -d '{"message": "My name is Ana"}'

curl -X POST "http://localhost:3000/api/chat?conversationId=bruno" \
  -H "Content-Type: application/json" \
  -d '{"message": "My name is Bruno"}'
```

Each `conversationId` has its own history, isolated from the others, and
is shared across whichever agents you use within it. If you don't send
this parameter, everything falls into a `"default"` conversation.

## Document upload

- `POST /api/documents` — uploads a `.pdf`, `.doc`, or `.docx` file
  (`file` field, `multipart/form-data`). 10 MB limit per file.
  ```bash
  curl -X POST http://localhost:3000/api/documents \
    -F "file=@/path/to/file.pdf"
  ```
- `GET /api/documents` — lists the files already saved in `uploads/`

## RAG: the AI querying your documents

When you upload a document, besides saving it in `uploads/`, the backend:

1. **Extracts the text** (`document-loader.service.ts`, using LangChain's
   *loaders*: `PDFLoader` for PDF, `DocxLoader` for DOC/DOCX)
2. **Splits it into smaller pieces** (~1000 characters, with overlap
   between them) — this is called *chunking*
3. **Generates an embedding** (a vector of numbers representing meaning)
   for each piece, using Ollama's `nomic-embed-text` model — prefixed
   with `"search_document: "`, the task prefix that model expects for
   text being indexed (as opposed to text doing the searching)
4. **Stores everything in an in-memory index** (`vectorstore.service.ts`,
   using LangChain's `MemoryVectorStore`)

Every time you send a message to `/api/chat` (via the `document-assistant`
agent) or `/api/chat/stream`, the backend embeds your question (prefixed
with `"search_query: "`) and searches the index for the document chunks
most *semantically* similar to it (this isn't keyword search!). The
search runs **per document**, not globally — each uploaded file gets its
own chance to contribute relevant chunks, so a large document can't
crowd out a smaller, more relevant one just by having far more chunks.
Chunks below a relevance threshold are discarded, so unrelated documents
don't add noise to unrelated questions. Whatever's left gets injected as
extra context before asking Ollama. If no document was uploaded, or
nothing relevant is found, the chat works normally, with no difference.

This is called **RAG (Retrieval-Augmented Generation)**: instead of only
relying on what the model "memorized" during training, we search for
relevant information and hand it over as context at response time.

> You need to have the embedding model pulled: `ollama pull nomic-embed-text`
> (the same command as always, just a different model).

The index itself lives **in memory** — but unlike before, restarting the
server no longer loses access to already-uploaded documents: on startup,
`reindexExistingDocuments()` re-reads and re-indexes everything already
sitting in `uploads/`, so nothing needs to be re-uploaded by hand.

## Rate limiting

Two limits apply, stacked on top of each other:

- **Every `/api/*` route**: 100 requests per IP per 15 minutes.
- **`POST /api/chat`, `POST /api/chat/stream`, `POST /api/documents`**
  (the endpoints that actually call Ollama): a stricter 20 requests per
  IP per 5 minutes, since each of those is slow and resource-heavy.

Going over either limit returns `429` with `{ "error": "..." }`. Limits
reset when the server restarts (in-memory, like everything else in this
project) — see `src/middlewares/rate-limit.middleware.ts` to adjust them.

## Type-checking, linting, tests, and build

```bash
npm run typecheck   # TypeScript compiler, checking types only (--noEmit)
npm run lint        # ESLint over the project's source
npm test            # runs the test suite (Vitest)
npm run build       # compiles to dist/ with tsc, for running without tsx
```

A GitHub Actions workflow (`.github/workflows/pull-request.yml`) runs all
four on every pull request into `main`.

## Switching the model

Edit `.env` and change `OLLAMA_MODEL` to any chat model you've pulled
(e.g. `mistral`, `phi3`, `gemma`), `OLLAMA_TOOL_MODEL` to change which
model the tool-calling agents use (see "Tool calling" above — it must
support tool calling), or `OLLAMA_EMBEDDING_MODEL` to switch the model
used for document search. `OLLAMA_MAX_TOKENS` and `OLLAMA_MAX_CONTEXT`
let you cap, respectively, how long a reply can be and how much text
(history + RAG context + question) the model can see at once — see
`.env.example` for details.
