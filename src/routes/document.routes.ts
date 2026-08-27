// "Routes" layer: defines the URLs for uploading/listing documents.

import { Router } from "express";
import { upload } from "../middlewares/upload.middleware.js";
import { handleUploadDocument, handleListDocuments } from "../controllers/document.controller.js";
import { ollamaRateLimiter } from "../middlewares/rate-limit.middleware.js";

export const documentRouter = Router();

// POST /api/documents  ->  form-data with a "file" field (.pdf, .doc, or .docx)
// upload.single("file") is multer's middleware: it reads the file, validates
// it, and saves it to disk BEFORE handleUploadDocument runs. ollamaRateLimiter
// applies here too — indexing a document calls Ollama once per chunk to
// generate embeddings, so it's just as worth rate-limiting as the chat endpoints.
documentRouter.post("/documents", ollamaRateLimiter, upload.single("file"), handleUploadDocument);

// GET /api/documents  ->  lists the files already saved
documentRouter.get("/documents", handleListDocuments);
