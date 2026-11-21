// Delivery challan calls, and what open challans hold back from a godown.
import { apiRequest } from "@/lib/api-client";
import type { ChallanStatusView, ChallanView } from "@/types/challan";

export const CHALLANS_PATH = "/delivery-challans";

export const STATUS_TEXT: Record<ChallanStatusView, { label: string; tone: "brand" | "success" | "danger" }> = {
  OPEN: { label: "Sent, not invoiced", tone: "brand" },
  INVOICED: { label: "Invoiced", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
};

export interface ChallanBody {
  date: string;
  number: string | null;
  partyId: string;
  godownId: string;
  quotationId: string | null;
  shipToLine: string | null;
  shipToCity: string | null;
  vehicleNumber: string | null;
  notes: string | null;
  lines: { itemId: string; quantity: number; rate?: number }[];
}

export const createChallan = (body: ChallanBody) => apiRequest<ChallanView>(CHALLANS_PATH, { method: "POST", body });

export const cancelChallan = (id: string, reason: string) => apiRequest<ChallanView>(`${CHALLANS_PATH}/${id}/cancel`, { method: "POST", body: { reason } });

export const challanPreviewPath = (date: string) => `/number-series/preview?kind=DELIVERY_CHALLAN&date=${date}`;

/** Quantity of each item on open challans from a godown, leaving out one challan. */
export function heldOnChallans(challans: ChallanView[], godownId: string, exceptId?: string): Map<string, number> {
  const held = new Map<string, number>();
  for (const challan of challans) {
    if (challan.status !== "OPEN" || challan.godownId !== godownId || challan.id === exceptId) continue;
    for (const line of challan.lines) held.set(line.itemId, (held.get(line.itemId) ?? 0) + line.quantity);
  }
  return held;
}

/** Where an invoice raised from the challan is made: export for a buyer outside India. */
export const invoiceFromChallanHref = (challan: ChallanView, overseas: boolean) => `/invoices/new/${overseas ? "export" : "local"}?challan=${challan.id}${challan.quotation ? `&quotation=${challan.quotation.id}` : ""}`;
