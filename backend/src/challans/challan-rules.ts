// What a delivery challan may send (client, 12 Nov 2026). Pure.
//   - Each item once, more than zero of it.
//   - No more than the godown holds less what other open challans already
//     hold back: goods on a challan are still ours until invoiced, but they
//     have left the godown, so they cannot go out twice.

const qty = (value: number) => Math.round(value * 1000) / 1000;

export interface ChallanStock {
  name: string;
  /** In the godown now (opening left plus batches remaining). */
  onHand: number;
  /** On other open challans from this godown. */
  onChallans: number;
}

/** Free to send: on hand less what open challans hold. */
export const freeToSend = (stock: ChallanStock) => qty(stock.onHand - stock.onChallans);

/** Null when the lines can go, else the first problem. */
export function challanLinesProblem(lines: { itemId: string; quantity: number }[], stock: Map<string, ChallanStock>): string | null {
  const seen = new Set<string>();
  for (const line of lines) {
    if (seen.has(line.itemId)) return 'Each item goes on one line only';
    seen.add(line.itemId);
    if (!(line.quantity > 0)) return 'Every line needs a quantity above zero';
    const item = stock.get(line.itemId);
    if (!item) return 'An item on the challan does not exist';
    const free = freeToSend(item);
    if (line.quantity > free) return `${item.name}: only ${free} is free to send from this godown (${item.onHand} in stock, ${item.onChallans} already on open challans)`;
  }
  return null;
}

/** An invoice raised from a challan bills the same customer from the same godown. */
export function invoiceFromChallanProblem(challan: { status: string; partyId: string; godownId: string; number: string }, invoice: { partyId: string; godownId: string }): string | null {
  if (challan.status !== 'OPEN') return `Challan ${challan.number} is ${challan.status === 'INVOICED' ? 'already invoiced' : 'cancelled'}`;
  if (challan.partyId !== invoice.partyId) return `Challan ${challan.number} was sent to another customer`;
  if (challan.godownId !== invoice.godownId) return `Challan ${challan.number} sent goods from another godown; bill from the same one`;
  return null;
}
