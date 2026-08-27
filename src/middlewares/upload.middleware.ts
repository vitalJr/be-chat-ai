import multer from "multer";
import type { FileFilterCallback } from "multer";
import type { Request } from "express";
import { UPLOADS_DIR } from "../config/uploads.js";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, UPLOADS_DIR);
  },
  filename: (req, file, callback) => {
    const uniquePrefix = Date.now();
    callback(null, `${uniquePrefix}-${file.originalname}`);
  },
});

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
    fileSize: 10 * 1024 * 1024,
  },
});
