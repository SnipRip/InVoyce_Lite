import { describe, expect, it } from 'vitest';
import { requiredPapers } from './document-register-rules.js';

describe('papers an invoice must carry', () => {
  it('asks a B2B invoice for its IRN, and the e-way bill above ₹50,000', () => {
    expect(requiredPapers({ treatment: 'REGISTERED', total: 50_000 })).toEqual(['E_INVOICE']);
    expect(requiredPapers({ treatment: 'REGISTERED', total: 80_000 })).toEqual(['E_INVOICE', 'EWAY_BILL']);
  });
  it('asks a consumer sale only for the e-way bill above the limit', () => {
    expect(requiredPapers({ treatment: 'CONSUMER', total: 30_000 })).toEqual([]);
    expect(requiredPapers({ treatment: 'UNREGISTERED', total: 80_000 })).toEqual(['EWAY_BILL']);
  });
});
