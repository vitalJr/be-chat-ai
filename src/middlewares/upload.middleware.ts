// Configures multer, the library that knows how to read files sent in
// multipart/form-data requests (the format used for file uploads).
// This middleware is ready to be "plugged" into a route, like:
//   router.post("/documents", upload.single("file"), handleUploadDocument)

import multer from "multer";
import type { FileFilterCallback } from "multer";
import type { Request } from "express";
import { UPLOADS_DIR } from "../config/uploads.js";

// Only these file types are allowed to be uploaded
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf", // .pdf
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
]);

// Where and under which name each file is saved on disk
const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, UPLOADS_DIR);
  },
  filename: (req, file, callback) => {
    // Prefixed with a timestamp to avoid two uploads with the same
    // filename overwriting each other
    const uniquePrefix = Date.now();
    callback(null, `${uniquePrefix}-${file.originalname}`);
  },
});

// Runs before saving: rejects the file if the type isn't allowed
function fileFilter(req: Request, file: Express.Multer.File, callback: FileFilterCallback) {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    callback(null, true);
  } else {
    callback(new Error("File type not allowed. Please upload only .pdf, .doc, or .docx."));
  }
}

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB per file
  },
});
