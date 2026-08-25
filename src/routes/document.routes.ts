// "Routes" layer: defines the URLs for uploading/listing documents.

import { Router } from "express";
import { upload } from "../middlewares/upload.middleware.js";
import { handleUploadDocument, handleListDocuments } from "../controllers/document.controller.js";

export const documentRouter = Router();

// POST /api/documents  ->  form-data with a "file" field (.pdf, .doc, or .docx)
// upload.single("file") is multer's middleware: it reads the file, validates
// it, and saves it to disk BEFORE handleUploadDocument runs
documentRouter.post("/documents", upload.single("file"), handleUploadDocument);

// GET /api/documents  ->  lists the files already saved
documentRouter.get("/documents", handleListDocuments);
