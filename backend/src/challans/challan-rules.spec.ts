import { describe, expect, it } from 'vitest';
import { challanLinesProblem, freeToSend, invoiceFromChallanProblem } from './challan-rules.js';

const stock = new Map([
  ['cement', { name: 'Cement', onHand: 100, onChallans: 30 }],
  ['tmt', { name: 'TMT 12 mm', onHand: 5, onChallans: 0 }],
]);

describe('challanLinesProblem', () => {
  it('lets out what is free in the godown', () => {
    expect(freeToSend(stock.get('cement')!)).toBe(70);
    expect(challanLinesProblem([{ itemId: 'cement', quantity: 70 }, { itemId: 'tmt', quantity: 5 }], stock)).toBeNull();
  });

  it('counts goods already on open challans', () => {
    expect(challanLinesProblem([{ itemId: 'cement', quantity: 71 }], stock)).toMatch(/only 70 is free.*100 in stock, 30 already on open challans/);
  });

  it('wants each item once, above zero', () => {
    expect(challanLinesProblem([{ itemId: 'tmt', quantity: 1 }, { itemId: 'tmt', quantity: 1 }], stock)).toMatch(/one line only/);
    expect(challanLinesProblem([{ itemId: 'tmt', quantity: 0 }], stock)).toMatch(/above zero/);
  });
});

describe('invoiceFromChallanProblem', () => {
  const challan = { status: 'OPEN', partyId: 'p1', godownId: 'g1', number: 'DC/2627/0001' };
  it('bills an open challan for the same customer and godown', () => {
    expect(invoiceFromChallanProblem(challan, { partyId: 'p1', godownId: 'g1' })).toBeNull();
    expect(invoiceFromChallanProblem({ ...challan, status: 'INVOICED' }, { partyId: 'p1', godownId: 'g1' })).toMatch(/already invoiced/);
    expect(invoiceFromChallanProblem(challan, { partyId: 'p2', godownId: 'g1' })).toMatch(/another customer/);
    expect(invoiceFromChallanProblem(challan, { partyId: 'p1', godownId: 'g2' })).toMatch(/another godown/);
  });
});
