# Ollama Chat API

Simple Node.js + TypeScript + Express API that sends messages to an AI
running locally via [Ollama](https://ollama.com) (100% free, no paid
account needed).

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
│   │   ├── chat.routes.ts          # Defines the chat URLs
│   │   └── document.routes.ts      # Defines the document upload URLs
│   ├── controllers/
│   │   ├── chat.controller.ts      # Receives the chat request and validates the data
│   │   └── document.controller.ts  # Receives the upload request
│   ├── middlewares/
│   │   └── upload.middleware.ts    # Configures multer (file validation/saving)
│   └── services/
│       ├── ollama.service.ts           # Actually talks to Ollama
│       ├── openai.service.ts           # Equivalent example using OpenAI (paid)
│       ├── conversation.store.ts       # Stores conversation history in memory
│       ├── document.store.ts           # Lists already-saved documents
│       ├── document-loader.service.ts  # Extracts text from PDF/DOC/DOCX and splits it into chunks
│       └── vectorstore.service.ts      # Semantic search index (RAG) with LangChain
├── uploads/                        # Where uploaded files are saved
```

A request always flows as: **route → controller → service**.

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
   { "reply": "Node.js is a runtime environment..." }
   ```

## Other endpoints

- `POST /api/chat/stream` — same as `/api/chat`, but the response arrives
  in chunks as the AI generates it (use `curl -N` to see the effect)
- `DELETE /api/chat` — clears the conversation history
- `GET /api/chat/history` — shows the history stored in memory (debug)
- `GET /health` — checks whether the server is up

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

Each `conversationId` has its own history, isolated from the others. If
you don't send this parameter, everything falls into a `"default"`
conversation — the behavior is identical to before this feature existed.

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
   for each piece, using Ollama's `nomic-embed-text` model
4. **Stores everything in an in-memory index** (`vectorstore.service.ts`,
   using LangChain's `MemoryVectorStore`)

Every time you send a message to `/api/chat` (or `/api/chat/stream`), the
backend searches the index for the document chunks most *semantically*
similar to your question (this isn't keyword search!) and injects those
excerpts as extra context before asking Ollama. If no document was
uploaded, or nothing relevant is found, the chat works normally, with no
difference.

This is called **RAG (Retrieval-Augmented Generation)**: instead of only
relying on what the model "memorized" during training, we search for
relevant information and hand it over as context at response time.

> You need to have the embedding model pulled: `ollama pull nomic-embed-text`
> (the same command as always, just a different model).

Just like the conversation history, this index lives **in memory** —
restarting the server wipes what's already been indexed (the files stay
in `uploads/`, but would need to be re-uploaded to become queryable again).

## Type-checking, linting, tests, and build

```bash
npm run typecheck   # TypeScript compiler, checking types only (--noEmit)
npm run lint        # ESLint over the project's source
npm test            # runs the test suite (Vitest)
npm run build       # compiles to dist/ with tsc, for running without tsx
```

## Switching the model

Edit `.env` and change `OLLAMA_MODEL` to any chat model you've pulled
(e.g. `mistral`, `phi3`, `gemma`), or `OLLAMA_EMBEDDING_MODEL` to switch
the model used for document search.
