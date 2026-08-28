import type { Request, Response } from "express";
import { loadAndSplitDocument } from "../services/document/document-loader.service.js";
import {
  addDocumentChunks,
  listIndexedSources,
} from "../services/vectorstore/vectorstore.service.js";

export async function handleUploadDocument(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({
      error: 'No file was sent. Use the "file" field in form-data.',
    });
  }

  let indexed = false;
  let indexError: string | undefined;

  try {
    const chunks = await loadAndSplitDocument(
      req.file.buffer,
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
      ? "File processed — the AI can now query it for this session."
      : "There was a problem processing the file's content.",
    file: {
      originalName: req.file.originalname,
      sizeInBytes: req.file.size,
      mimeType: req.file.mimetype,
    },
    indexed,
    ...(indexError ? { indexError } : {}),
  });
}

export function handleListDocuments(req: Request, res: Response) {
  return res.json({ documents: listIndexedSources() });
}
