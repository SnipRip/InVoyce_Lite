// The GST % a document line is saved at. Pure. Used by quotations, invoices
// and vendor bills.
//
// The item's HSN / SAC (item → HSN master → group → sub-category → category,
// item-document-facts.ts) gives the rate. The company profile decides
// whether a line may say otherwise (`enforceHsnGstRate`, 7 Nov 2026): when
// on, a typed rate that differs is refused; when off, the typed rate stands
// and the HSN rate only fills a line that sent none. A document marked "GST
// not applicable" saves every line at 0%.

export interface LineGstRateInput {
  item: { name: string; gstRatePct: number | null };
  /** As typed on the line; undefined / null = take the HSN rate. */
  typed?: number | null;
  enforce: boolean;
  /** False: the document carries no GST. */
  applicable: boolean;
}

export function lineGstRate({ item, typed, enforce, applicable }: LineGstRateInput): { rate: number; problem?: undefined } | { rate?: undefined; problem: string } {
  if (!applicable) return { rate: 0 };
  const master = item.gstRatePct;
  if (enforce) {
    if (master === null) return { problem: `${item.name} has no GST rate: set its HSN in the HSN master` };
    if (typed != null && Math.abs(typed - master) > 0.001) {
      return { problem: `${item.name} takes ${master}% GST from its HSN. The company setting allows only the HSN rate` };
    }
    return { rate: master };
  }
  if (typed != null) return { rate: typed };
  if (master === null) return { problem: `${item.name} has no GST rate: set its HSN in the HSN master, or enter the rate` };
  return { rate: master };
}
