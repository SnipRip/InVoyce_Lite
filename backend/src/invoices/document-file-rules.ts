// What a dispatch document's file may be (client, 12 Nov 2026): a PDF or a
// picture, read from its first bytes so a renamed program is refused, up to
// 2 MB, five per document. The database CHECKs the type and size too.
import { pictureType } from '../items/item-picture-rules.js';

export const MAX_DOCUMENT_FILE_BYTES = 2 * 1024 * 1024;
export const DOCUMENT_FILE_TOO_LARGE = 'The file is over 2 MB. Scan at a lower resolution or save the PDF smaller';
export const MAX_FILES_PER_DOCUMENT = 5;

export type DocumentFileType = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp';

/** "%PDF-" at the start; else a JPEG, PNG or WebP picture; else null. */
export function documentFileType(bytes: Uint8Array): DocumentFileType | null {
  const pdf = [0x25, 0x50, 0x44, 0x46, 0x2d];
  if (bytes.length >= pdf.length && pdf.every((byte, index) => bytes[index] === byte)) return 'application/pdf';
  return pictureType(bytes);
}

export function documentFileProblem(bytes: Uint8Array, filesSoFar: number): string | null {
  if (bytes.length === 0) return 'The file is empty';
  if (bytes.length > MAX_DOCUMENT_FILE_BYTES) return DOCUMENT_FILE_TOO_LARGE;
  if (!documentFileType(bytes)) return 'Upload a PDF, or a JPEG, PNG or WebP scan';
  if (filesSoFar >= MAX_FILES_PER_DOCUMENT) return `A document can have up to ${MAX_FILES_PER_DOCUMENT} files. Remove one first`;
  return null;
}

/** A file name safe to store and send back: no path, no control characters, 120 characters at most. */
export function cleanFileName(name: string | undefined, type: DocumentFileType): string {
  const base = (name ?? '').split(/[\\/]/).pop()!.replace(/[^\p{L}\p{N} ._()-]/gu, '').trim().slice(0, 120);
  const extension = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[type];
  return base || `document.${extension}`;
}
