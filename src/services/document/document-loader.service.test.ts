// guessMimeType is a pure function (just string matching on a file
// extension) — the only piece of document-loader.service.ts that's
// testable without a real PDF/DOC/DOCX file and a LangChain loader.
import { describe, expect, it } from "vitest";
import { guessMimeType } from "./document-loader.service.js";

describe("guessMimeType", () => {
  it("recognizes .pdf", () => {
    expect(guessMimeType("report.pdf")).toBe("application/pdf");
  });

  it("recognizes .docx", () => {
    expect(guessMimeType("notes.docx")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });

  it("recognizes .doc", () => {
    expect(guessMimeType("old-notes.doc")).toBe("application/msword");
  });

  it("is case-insensitive", () => {
    expect(guessMimeType("REPORT.PDF")).toBe("application/pdf");
  });

  it("handles the '<timestamp>-<name>' filenames upload.middleware.ts saves", () => {
    expect(guessMimeType("1787661808636-Resume.pdf")).toBe("application/pdf");
  });

  it("returns undefined for an unrecognized extension", () => {
    expect(guessMimeType("image.png")).toBeUndefined();
  });

  it("returns undefined for a file with no extension", () => {
    expect(guessMimeType("README")).toBeUndefined();
  });
});
