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
├── index.ts                        # Entry point: starts the server
├── tsconfig.json                   # TypeScript configuration
├── src/
│   ├── app.ts                      # Assembles Express (middlewares + routes)
│   ├── types.ts                    # Shared types (e.g. Message)
│   ├── config/
│   │   └── env.ts                  # Reads environment variables (.env)
│   ├── routes/
│   │   ├── chat.routes.ts          # Chat URLs
│   │   ├── document.routes.ts      # Document upload URLs
│   │   └── agent.routes.ts         # GET /api/agents
│   ├── controllers/
│   │   ├── chat.controller.ts      # Receives the chat request, picks the agent, validates data
│   │   ├── document.controller.ts  # Receives the upload request
│   │   └── agent.controller.ts     # Lists available agents
│   ├── middlewares/
│   │   ├── upload.middleware.ts    # Configures multer (in-memory, no disk storage)
│   │   ├── audio-upload.middleware.ts # Same, but for the /api/chat "audio" field
│   │   └── rate-limit.middleware.ts # Caps requests per IP
│   ├── agents/                     # One file per agent — see "Agents" below
│   │   ├── agent.types.ts          # The AgentDefinition contract every agent implements
│   │   ├── tool-calling-graph.ts   # Shared generate<->tools loop, reused by any agent that needs tools
│   │   ├── document-assistant.agent.ts  # RAG: searches your documents before answering
│   │   ├── general-assistant.agent.ts   # Tool-calling: docs, web search, or delegates to veterinary-assistant
│   │   ├── translator.agent.ts          # Persona-only agent: always replies in English
│   │   ├── veterinary-assistant.agent.ts # Pet health & care, searches the web as a fallback
│   │   └── web-search.agent.ts          # Searches the web (SerpAPI) when it needs to
│   └── services/
│       ├── agent-registry.ts       # Catalog of every registered agent
│       ├── ollama/
│       │   └── ollama.service.ts       # Talks to Ollama (via LangChain's ChatOllama)
│       ├── ai/
│       │   └── openai.service.ts       # Equivalent example using OpenAI (paid)
│       ├── speech/
│       │   └── speech-to-text.service.ts # Transcribes audio locally with Whisper (free, no API key)
│       ├── conversation/
│       │   └── conversation.store.ts   # Stores conversation history in SQLite (survives restarts)
│       ├── document/
│       │   └── document-loader.service.ts  # Extracts text from PDF/DOC/DOCX and splits it into chunks
│       └── vectorstore/
│           └── vectorstore.service.ts  # Semantic search index (RAG) with LangChain + Chroma Cloud
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

4. Create a free [Chroma Cloud](https://www.trychroma.com) account and
   database — this is the vector database used for RAG (see "RAG"
   below). Copy `CHROMA_API_KEY`, `CHROMA_TENANT`, and `CHROMA_DATABASE`
   from your database's "sdk" tab into `.env` — see `.env.example` for
   where. You only need this if you're going to upload documents (RAG);
   the rest of the API works without it.

5. Start the API (runs the TypeScript directly, no build needed):
   ```bash
   npm start
   ```
   During development, use `npm run dev` instead — it restarts
   automatically on every file change.

6. Test it with curl (in another terminal):
   ```bash
   curl -X POST http://localhost:3000/api/chat \
     -H "Content-Type: application/json" \
     -d '{"message": "Explain what Node.js is in one sentence"}'
   ```

   Expected response:
   ```json
   { "reply": "Node.js is a runtime environment...", "conversationId": "default", "agentId": "document-assistant", "message": "Explain what Node.js is in one sentence" }
   ```

## Other endpoints

- `POST /api/chat/stream` — same as `/api/chat`, but the response arrives
  in chunks as the AI generates it (use `curl -N` to see the effect).
  Always uses the `document-assistant` agent's RAG behavior — not
  agent-selectable yet (see "Agents" below).
- `DELETE /api/chat` — clears the conversation history
- `GET /api/chat/history` — shows the conversation's stored history (debug)
- `GET /api/agents` — lists every available agent
- `GET /health` — checks whether the server is up

Requests beyond the configured rate limit get a `429` response (see
"Rate limiting" below).

## Voice input (audio → text)

`POST /api/chat` and `POST /api/chat/stream` also accept an audio file
instead of a `message` field. Send it as `multipart/form-data` under the
`audio` key; the backend transcribes it locally with Whisper
(`speech-to-text.service.ts`, via [@huggingface/transformers](https://huggingface.co/docs/transformers.js))
before handing the text to the agent, same as if you had typed it. 100%
free, no API key, no account — runs on your own CPU. Accepted formats:
`webm`, `ogg`, `wav`, `mp3`, `mp4`, `m4a` (up to 25 MB, decoded with the
bundled `ffmpeg-static` binary).

The Whisper model (`WHISPER_MODEL` in `.env`, default
`Xenova/whisper-base`, ~150 MB) downloads automatically from Hugging Face
on the first transcription and is cached in `.cache/transformers/` —
that first request is slow (and needs internet once); every request
after that runs offline and takes about a second per short clip on a
modern CPU.

```bash
curl -X POST http://localhost:3000/api/chat \
  -F "audio=@/path/to/recording.webm"
```

The response includes the transcribed text in the `message` field, so
the client can show the user what was understood:

```json
{ "reply": "...", "conversationId": "default", "agentId": "document-assistant", "message": "Explain what Node.js is in one sentence" }
```

You can still send plain JSON with a `message` field as before — the two
input modes are mutually exclusive per request.

Set `WHISPER_LANGUAGE` in `.env` (e.g. `portuguese`) to match the
language you'll be speaking. Without it, Whisper defaults to English —
the `@huggingface/transformers` implementation doesn't auto-detect the
spoken language yet.

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
| `general-assistant` | Plain chat that decides on its own whether to search your uploaded documents, search the web, or consult `veterinary-assistant` — instead of always searching first like `document-assistant`, or needing a specific `agentId` like `web-search`/`veterinary-assistant`. Uses tool-calling, so it needs `OLLAMA_TOOL_MODEL` — see "Tool calling" below. |
| `translator` | Translates whatever you write into English, ignoring everything else the message asks for. |
| `veterinary-assistant` | Answers questions about pet health, nutrition, behavior, and care. Searches the web when it isn't confident in its own answer. |
| `web-search` | Searches the web (SerpAPI) when it needs current or specific information to answer. |

Example:
```bash
curl -X POST "http://localhost:3000/api/chat?agentId=general-assistant" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hi there"}'
```
(needs `OLLAMA_TOOL_MODEL` set — see "Tool calling" below)

If you don't send `agentId`, you get `document-assistant` — identical to
the behavior before agents existed. An unknown `agentId` returns `400`.

**Adding a new agent**: create a file in `src/agents/` exporting an
`AgentDefinition`, then list it in `REGISTERED_AGENTS` in
`src/services/agent-registry.ts`. Nothing else needs to change.

## Tool calling

`web-search` and `veterinary-assistant` can call a real tool — a web
search via [SerpAPI](https://serpapi.com) — instead of only answering
from what the model already knows. `general-assistant` goes further: it
can call `document-assistant`'s document search, and can also delegate
the whole question to `web-search` or `veterinary-assistant` as
sub-agents (each one it's own tool, calling that agent's `invoke(...)`
directly — see `general-assistant.agent.ts`). In every case, the model
itself decides, per message, whether it needs a tool or can answer
directly; there's no code forcing it to run.

All four need `OLLAMA_TOOL_MODEL` set in `.env` — the plain
`OLLAMA_MODEL` (`llama3` by default) doesn't reliably support tool
calling. Pull a model that does (e.g. `ollama pull llama3.2`) and set
`OLLAMA_TOOL_MODEL=llama3.2`.

`web-search` and `veterinary-assistant` also need **`SERPAPI_API_KEY`**
— free tier available at [serpapi.com](https://serpapi.com), key at
[serpapi.com/manage-api-key](https://serpapi.com/manage-api-key).
Without it, those two agents fail on *every* message (not just ones that
need a search), because both build their `SerpAPI` tool eagerly at graph
construction time. This also affects `general-assistant` indirectly:
asking it something that makes it delegate to `web-search` or
`veterinary-assistant` fails too, even if the sub-agent could have
answered from its own knowledge without searching — but `general-assistant`
itself, and its own document-search tool, work fine without the key, as
does everything it can answer directly.

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

Conversation history is stored in a local SQLite database
(`conversations.db` by default — see `CONVERSATION_DB_PATH` in
`.env.example`) and **survives a server restart**, unlike the RAG index
and uploaded documents (see "Document upload" below).

## Document upload

- `POST /api/documents` — uploads a `.pdf`, `.doc`, or `.docx` file
  (`file` field, `multipart/form-data`). 10 MB limit per file. The
  original file itself is only ever held in memory and discarded after
  indexing — **the raw file is never saved to disk** — but the extracted
  chunks and their embeddings are, in Chroma (see "RAG" below).
  ```bash
  curl -X POST http://localhost:3000/api/documents \
    -F "file=@/path/to/file.pdf"
  ```
- `GET /api/documents` — lists the documents currently indexed

## RAG: the AI querying your documents

When you upload a document, the backend:

1. **Extracts the text** (`document-loader.service.ts`, using LangChain's
   *loaders*: `PDFLoader` for PDF, `DocxLoader` for DOC/DOCX)
2. **Splits it into smaller pieces** (~1000 characters, with overlap
   between them) — this is called *chunking*
3. **Generates an embedding** (a vector of numbers representing meaning)
   for each piece, using Ollama's `nomic-embed-text` model — prefixed
   with `"search_document: "`, the task prefix that model expects for
   text being indexed (as opposed to text doing the searching)
4. **Stores everything in Chroma Cloud** (`vectorstore.service.ts`, via
   LangChain's `Chroma` vector store + the `CloudClient` from `chromadb`)
   — a hosted vector database, see step 4 in "How to run"

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

The index **survives a server restart** (and even a full reinstall on a
different machine) — it's stored in your Chroma Cloud database, not in
the Node process's memory. Documents you uploaded stay searchable across
restarts; you only need to re-upload if you delete the collection on
Chroma Cloud's side. (This changed recently — earlier versions of this
project used an in-memory index that reset on every restart.)

> Chroma Cloud has a free tier with limited storage/usage — check
> [trychroma.com/pricing](https://www.trychroma.com/pricing) if you plan
> to index a lot of documents.

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
