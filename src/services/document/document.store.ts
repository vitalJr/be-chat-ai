// "Service" layer: deals with what's already saved in the uploads folder.
// The controller doesn't touch the filesystem directly — it asks this
// service, the same way we ask ollama.service.js to talk to Ollama.

import fs from "node:fs";
import path from "node:path";
import { UPLOADS_DIR } from "../../config/uploads.js";
import { guessMimeType, loadAndSplitDocument } from "./document-loader.service.js";
import { addDocumentChunks } from "../vectorstore/vectorstore.service.js";

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

// upload.middleware.ts saves files as "<timestamp>-<original name>" to
// avoid collisions. Reverses that so the reindexed document's "source"
// metadata shows the human-readable name, not the disk filename.
function extractOriginalName(storedFileName: string): string {
  return storedFileName.replace(/^\d+-/, "");
}

/**
 * Re-reads and re-indexes every document already sitting in uploads/,
 * rebuilding the in-memory vector store (see vectorstore.service.ts)
 * after a restart wipes it. The files on disk always survive a
 * restart — only the searchable index doesn't, so this is what makes
 * previously uploaded documents queryable again without re-uploading
 * them by hand. Meant to run once, at startup (see index.ts).
 *
 * Skips any file whose type it doesn't recognize, and logs (without
 * throwing) if a specific file fails to process, so one bad file
 * doesn't stop the rest from being indexed.
 */
export async function reindexExistingDocuments(): Promise<void> {
  const fileNames = fs.readdirSync(UPLOADS_DIR);
  let reindexedCount = 0;

  for (const fileName of fileNames) {
    const mimeType = guessMimeType(fileName);

    if (!mimeType) {
      console.warn(`Skipping "${fileName}" while reindexing: unrecognized file type.`);
      continue;
    }

    try {
      const filePath = path.join(UPLOADS_DIR, fileName);
      const chunks = await loadAndSplitDocument(filePath, mimeType, extractOriginalName(fileName));
      await addDocumentChunks(chunks);
      reindexedCount++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error.";
      console.error(`Failed to reindex "${fileName}":`, message);
    }
  }

  if (reindexedCount > 0) {
    console.log(`Reindexed ${reindexedCount} document(s) from uploads/.`);
  }
}
