// "Controller" layer: receives the request already processed by multer
// (req.file populated). Besides confirming the save, it triggers content
// extraction and indexing into the vector store, so the AI can later
// query the document during conversations.

import type { Request, Response } from "express";
import { listDocuments } from "../services/document/document.store.js";
import { loadAndSplitDocument } from "../services/document/document-loader.service.js";
import { addDocumentChunks } from "../services/vectorstore/vectorstore.service.js";

// POST /api/documents  (multipart/form-data, "file" field)
export async function handleUploadDocument(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({
      error: 'No file was sent. Use the "file" field in form-data.',
    });
  }

  // The file is already saved to disk at this point (multer handled that).
  // Now we extract the text and index it — if this fails, the file
  // remains saved, it just won't be available for the AI to query.
  let indexed = false;
  let indexError: string | undefined;

  try {
    const chunks = await loadAndSplitDocument(
      req.file.path,
      req.file.mimetype,
      req.file.originalname,
    );
    await addDocumentChunks(chunks);
    indexed = true;
  } catch (error) {
    indexError =
      error instanceof Error
        ? error.message
        : "Unknown error while processing the document.";
    console.error("Error indexing document:", indexError);
  }

  return res.status(201).json({
    message: indexed
      ? "File saved and processed — the AI can now query it."
      : "File saved, but there was a problem processing its content.",
    file: {
      name: req.file.filename,
      originalName: req.file.originalname,
      sizeInBytes: req.file.size,
      mimeType: req.file.mimetype,
    },
    indexed,
    ...(indexError ? { indexError } : {}),
  });
}

// GET /api/documents  ->  lists the files already saved in the uploads/ folder
export function handleListDocuments(req: Request, res: Response) {
  return res.json({ documents: listDocuments() });
}
