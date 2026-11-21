import { describe, expect, it } from 'vitest';
import { cleanFileName, documentFileProblem, documentFileType, MAX_DOCUMENT_FILE_BYTES } from './document-file-rules.js';

const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);

describe('documentFileType', () => {
  it('reads PDFs and pictures from their first bytes', () => {
    expect(documentFileType(pdf)).toBe('application/pdf');
    expect(documentFileType(jpeg)).toBe('image/jpeg');
    expect(documentFileType(new Uint8Array([0x4d, 0x5a, 0x90]))).toBeNull();
  });
});

describe('documentFileProblem', () => {
  it('takes a PDF or scan up to 2 MB, five per document', () => {
    expect(documentFileProblem(pdf, 0)).toBeNull();
    expect(documentFileProblem(new Uint8Array(0), 0)).toMatch(/empty/);
    expect(documentFileProblem(new Uint8Array(MAX_DOCUMENT_FILE_BYTES + 1).fill(0x25), 0)).toMatch(/over 2 MB/);
    expect(documentFileProblem(new Uint8Array([0x4d, 0x5a]), 0)).toMatch(/PDF, or a JPEG/);
    expect(documentFileProblem(pdf, 5)).toMatch(/up to 5 files/);
  });
});

describe('cleanFileName', () => {
  it('keeps a plain name and drops paths and odd characters', () => {
    expect(cleanFileName('E-way bill 4521.pdf', 'application/pdf')).toBe('E-way bill 4521.pdf');
    expect(cleanFileName('C:\\scans\\brc<1>.jpg', 'image/jpeg')).toBe('brc1.jpg');
    expect(cleanFileName(undefined, 'image/png')).toBe('document.png');
  });
});
