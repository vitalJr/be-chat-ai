// "Service" layer: deals with what's already saved in the uploads folder.
// The controller doesn't touch the filesystem directly — it asks this
// service, the same way we ask ollama.service.js to talk to Ollama.

import fs from "node:fs";
import path from "node:path";
import { UPLOADS_DIR } from "../config/uploads.js";

export interface StoredDocument {
  name: string;
  sizeInBytes: number;
  uploadedAt: string;
}

/**
 * Lists every document saved in the uploads folder, with name, size,
 * and the date it was saved.
 */
export function listDocuments(): StoredDocument[] {
  const fileNames = fs.readdirSync(UPLOADS_DIR);

  return fileNames.map((name) => {
    const stats = fs.statSync(path.join(UPLOADS_DIR, name));

    return {
      name,
      sizeInBytes: stats.size,
      uploadedAt: stats.birthtime.toISOString(),
    };
  });
}
