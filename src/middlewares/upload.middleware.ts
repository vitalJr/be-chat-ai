import multer from "multer";
import type { FileFilterCallback } from "multer";
import type { Request } from "express";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function fileFilter(req: Request, file: Express.Multer.File, callback: FileFilterCallback) {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    callback(null, true);
  } else {
    callback(new Error("File type not allowed. Please upload only .pdf, .doc, or .docx."));
  }
}

export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});
