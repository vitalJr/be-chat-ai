import multer from "multer";
import type { FileFilterCallback } from "multer";
import type { Request } from "express";

const ALLOWED_AUDIO_MIME_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
]);

function audioFileFilter(
  req: Request,
  file: Express.Multer.File,
  callback: FileFilterCallback,
) {
  if (ALLOWED_AUDIO_MIME_TYPES.has(file.mimetype)) {
    callback(null, true);
  } else {
    callback(
      new Error(
        "Audio format not allowed. Please send webm, ogg, wav, mp3, mp4 or m4a.",
      ),
    );
  }
}

export const uploadAudio = multer({
  storage: multer.memoryStorage(),
  fileFilter: audioFileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});
