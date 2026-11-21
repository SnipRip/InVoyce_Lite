import { describe, expect, it } from 'vitest';
import { conversionProblem, quantityOut } from './invoice-rules.js';

describe('conversionProblem', () => {
  it('invoices a sent or accepted quotation once', () => {
    expect(conversionProblem('SENT')).toBeNull();
    expect(conversionProblem('ACCEPTED')).toBeNull();
    expect(conversionProblem('CONVERTED')).toMatch(/already invoiced/);
    expect(conversionProblem('DRAFT')).toMatch(/draft/);
    expect(conversionProblem('CANCELLED')).toMatch(/cancelled/);
    expect(conversionProblem('REJECTED')).toMatch(/rejected/);
  });
});

describe('quantityOut', () => {
  it('sends the free units out of stock too', () => {
    expect(quantityOut({ quantity: 100, freeQuantity: 10 })).toBe(110);
    expect(quantityOut({ quantity: 0.1, freeQuantity: 0.2 })).toBe(0.3);
  });
});
