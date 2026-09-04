import "server-only";

import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { HttpError } from "@/lib/api";

export const MAX_CHARACTER_SOURCE_FILE_BYTES = 4_000_000;
export const MAX_CHARACTER_SOURCE_TEXT_CHARS = 24_000;
export const MAX_CHARACTER_SOURCE_PDF_PAGES = 80;
const MAX_DOCX_XML_BYTES = 8_000_000;
const MAX_DOCX_ENTRIES = 1_000;

const supportedExtensions = new Set(["txt", "md", "json", "yaml", "yml", "docx", "pdf"]);

export type CharacterSourceFile = {
  name: string;
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export type ExtractedCharacterSource = {
  fileName: string;
  extension: string;
  text: string;
  originalCharacterCount: number;
  truncated: boolean;
  warnings: string[];
};

export async function extractCharacterSourceFile(file: CharacterSourceFile): Promise<ExtractedCharacterSource> {
  const fileName = normalizeFileName(file.name);
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";

  if (!supportedExtensions.has(extension)) {
    throw new HttpError(415, "Use a TXT, Markdown, JSON, YAML, DOCX, or PDF file.");
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    throw new HttpError(400, "The selected file is empty.");
  }
  if (file.size > MAX_CHARACTER_SOURCE_FILE_BYTES) {
    throw new HttpError(413, "The selected file is larger than 4 MB.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  validateSignature(extension, bytes);

  let extracted = "";
  try {
    extracted = await extractTextByExtension(extension, bytes);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(422, `Could not read this ${extension.toUpperCase()} document.`);
  }
  const normalized = normalizeExtractedText(extracted);
  if (normalized.length < 12) {
    throw new HttpError(422, "The file does not contain enough readable text to create a character.");
  }

  const truncated = normalized.length > MAX_CHARACTER_SOURCE_TEXT_CHARS;
  return {
    fileName,
    extension,
    text: normalized.slice(0, MAX_CHARACTER_SOURCE_TEXT_CHARS),
    originalCharacterCount: normalized.length,
    truncated,
    warnings: truncated
      ? [`Only the first ${MAX_CHARACTER_SOURCE_TEXT_CHARS.toLocaleString("en-US")} characters were analyzed.`]
      : []
  };
}

async function extractTextByExtension(extension: string, bytes: Uint8Array) {
  if (extension === "docx") {
    validateDocxArchive(bytes);
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return result.value;
  }

  if (extension === "pdf") {
    const document = await getDocumentProxy(bytes);
    try {
      if (document.numPages > MAX_CHARACTER_SOURCE_PDF_PAGES) {
        throw new HttpError(422, `PDF files are limited to ${MAX_CHARACTER_SOURCE_PDF_PAGES} pages.`);
      }
      const result = await extractText(document, { mergePages: true });
      return result.text;
    } finally {
      const destroy = (document as unknown as { destroy?: () => Promise<void> }).destroy;
      if (destroy) {
        await destroy.call(document).catch(() => undefined);
      }
    }
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new HttpError(415, "Text files must use UTF-8 encoding.");
  }
}

function normalizeExtractedText(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function validateSignature(extension: string, bytes: Uint8Array) {
  if (extension === "pdf" && !startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    throw new HttpError(415, "The selected file is not a valid PDF document.");
  }
  if (extension === "docx" && !startsWith(bytes, [0x50, 0x4b])) {
    throw new HttpError(415, "The selected file is not a valid DOCX document.");
  }
  if (!["pdf", "docx"].includes(extension) && bytes.includes(0)) {
    throw new HttpError(415, "The selected text file contains binary data.");
  }
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((byte, index) => bytes[index] === byte);
}

function validateDocxArchive(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder("utf-8");
  let entries = 0;
  let xmlBytes = 0;
  let hasDocumentXml = false;

  for (let offset = 0; offset <= bytes.length - 46;) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      offset += 1;
      continue;
    }

    const uncompressedSize = view.getUint32(offset + 24, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const entryLength = 46 + fileNameLength + extraLength + commentLength;
    if (offset + entryLength > bytes.length || uncompressedSize === 0xffffffff) {
      throw new HttpError(422, "The DOCX archive uses an unsupported structure.");
    }

    const fileName = decoder.decode(bytes.slice(offset + 46, offset + 46 + fileNameLength)).replace(/\\/g, "/");
    entries += 1;
    if (fileName === "word/document.xml") hasDocumentXml = true;
    if (fileName.endsWith(".xml") || fileName.endsWith(".rels")) xmlBytes += uncompressedSize;
    if (entries > MAX_DOCX_ENTRIES || xmlBytes > MAX_DOCX_XML_BYTES) {
      throw new HttpError(422, "The DOCX archive expands beyond the safe document limit.");
    }

    offset += entryLength;
  }

  if (entries === 0 || !hasDocumentXml) {
    throw new HttpError(415, "The selected file is not a valid DOCX document.");
  }
}

function normalizeFileName(value: string) {
  const name = value.replace(/\\/g, "/").split("/").pop()?.trim() ?? "";
  if (!name || name.length > 180) {
    throw new HttpError(400, "The selected file name is invalid.");
  }
  return name;
}
