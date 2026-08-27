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

export function guessMimeType(fileName: string): string | undefined {
  const extension = fileName.toLowerCase().split(".").pop();

  if (extension === "pdf") return PDF_MIME_TYPE;
  if (extension === "docx") return DOCX_MIME_TYPE;
  if (extension === "doc") return DOC_MIME_TYPE;

  return undefined;
}

export async function loadAndSplitDocument(
  filePath: string,
  mimeType: string,
  sourceName: string,
): Promise<Document[]> {
  const rawDocuments = await loadRawDocument(filePath, mimeType);

  const documentsWithSource = rawDocuments.map((doc) => {
    doc.metadata = { ...doc.metadata, source: sourceName };
    return doc;
  });

  return splitter.splitDocuments(documentsWithSource);
}

async function loadRawDocument(filePath: string, mimeType: string): Promise<Document[]> {
  if (mimeType === PDF_MIME_TYPE) {
    return new PDFLoader(filePath).load();
  }

  if (mimeType === DOCX_MIME_TYPE) {
    return new DocxLoader(filePath, { type: "docx" }).load();
  }

  if (mimeType === DOC_MIME_TYPE) {
    return new DocxLoader(filePath, { type: "doc" }).load();
  }

  throw new Error(`Unsupported file type for reading: ${mimeType}`);
}
