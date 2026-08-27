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

function extractOriginalName(storedFileName: string): string {
  return storedFileName.replace(/^\d+-/, "");
}

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
