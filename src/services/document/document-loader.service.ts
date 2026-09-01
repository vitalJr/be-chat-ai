import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import type { Document } from "@langchain/core/documents";

const PDF_MIME_TYPE = "application/pdf";
const DOC_MIME_TYPE = "application/msword";
const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 150,
});

export async function loadAndSplitDocument(
  fileBuffer: Buffer,
  mimeType: string,
  sourceName: string,
): Promise<Document[]> {
  const blob = new Blob([new Uint8Array(fileBuffer)]);
  const rawDocuments = await loadRawDocument(blob, mimeType);

  const documentsWithSource = rawDocuments.map((doc) => {
    doc.metadata = { source: sourceName };
    return doc;
  });

  return splitter.splitDocuments(documentsWithSource);
}

async function loadRawDocument(blob: Blob, mimeType: string): Promise<Document[]> {
  if (mimeType === PDF_MIME_TYPE) {
    return new PDFLoader(blob).load();
  }

  if (mimeType === DOCX_MIME_TYPE) {
    return new DocxLoader(blob, { type: "docx" }).load();
  }

  if (mimeType === DOC_MIME_TYPE) {
    return new DocxLoader(blob, { type: "doc" }).load();
  }

  throw new Error(`Unsupported file type for reading: ${mimeType}`);
}
