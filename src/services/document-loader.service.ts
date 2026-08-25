// This file knows how to READ the content of a document saved on disk
// (PDF, DOC, or DOCX) and split it into smaller pieces (chunks). This is
// necessary because: 1) embedding models have a text limit per call, and
// 2) smaller chunks make search more precise (we find exactly the
// relevant paragraph, not the whole document).

// PDFLoader and DocxLoader are LangChain classes: each one knows how to
// open a specific file type and return the extracted text
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
// The class that does the text "cutting" into smaller pieces
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
// Document is LangChain's standard format for representing a piece of
// text + metadata (e.g. which file it came from). "import type" because
// this is only used for TypeScript typing, it doesn't exist at runtime
import type { Document } from "@langchain/core/documents";

// Constants with the MIME types we know how to read — the same values
// upload.middleware.ts already uses to validate what can be uploaded
const PDF_MIME_TYPE = "application/pdf";
const DOC_MIME_TYPE = "application/msword";
const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// We create the text "splitter" ONCE here, outside the functions, and
// reuse it on every call — no need to recreate it for every document
const splitter = new RecursiveCharacterTextSplitter({
  // Maximum size of each chunk, in characters
  chunkSize: 1000,
  // How many characters from the end of a chunk repeat at the start of
  // the next one. The overlap avoids losing context from sentences that
  // would otherwise get "cut in half" right at the boundary between chunks.
  chunkOverlap: 150,
});

/**
 * Reads a file saved on disk, extracts the text, and splits it into
 * smaller pieces, ready to become embeddings.
 * @param filePath - full path of the file on disk
 * @param mimeType - the file's type (determines which "reader" to use)
 * @param sourceName - the file's original name, stored as metadata
 */
export async function loadAndSplitDocument(
  filePath: string,
  mimeType: string,
  sourceName: string,
): Promise<Document[]> {
  // First extracts the raw text from the file (not yet split into chunks).
  // A PDF can turn into more than one Document here, e.g. one per page
  const rawDocuments = await loadRawDocument(filePath, mimeType);

  // Attaches the original filename to each piece, so we can later show
  // "where" each piece of information used in a response came from.
  // The "..." (spread) copies the metadata that already existed and adds the new "source"
  const documentsWithSource = rawDocuments.map((doc) => {
    doc.metadata = { ...doc.metadata, source: sourceName };
    return doc;
  });

  // splitDocuments does two things: cuts the text into smaller pieces AND
  // copies the metadata (including the "source" we just added) to each
  // resulting chunk — that's why we set the metadata BEFORE splitting
  return splitter.splitDocuments(documentsWithSource);
}

// "Private" function (no "export"): only used within this file.
// Decides WHICH LangChain reader to use, based on the file's type
async function loadRawDocument(filePath: string, mimeType: string): Promise<Document[]> {
  if (mimeType === PDF_MIME_TYPE) {
    // .load() reads the file from disk and returns the list of Documents with the text already extracted
    return new PDFLoader(filePath).load();
  }

  if (mimeType === DOCX_MIME_TYPE) {
    // DocxLoader handles both .docx and .doc — the "type" in the second
    // parameter is what tells it which of the two formats to read
    return new DocxLoader(filePath, { type: "docx" }).load();
  }

  if (mimeType === DOC_MIME_TYPE) {
    // .doc (old, binary format) uses a different library under the hood
    // (word-extractor), but the call here looks similar
    return new DocxLoader(filePath, { type: "doc" }).load();
  }

  // Should never get here, since upload.middleware.ts only lets these
  // three types through — but it's a safeguard in case that ever changes
  throw new Error(`Unsupported file type for reading: ${mimeType}`);
}
