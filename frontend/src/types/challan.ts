// A delivery challan as the backend returns it (backend/src/challans).

export type ChallanStatusView = "OPEN" | "INVOICED" | "CANCELLED";

export interface ChallanLineView {
  id: string;
  itemId: string;
  itemName: string;
  sku: string | null;
  hsn: string | null;
  unit: string;
  /** Base units. */
  quantity: number;
  /** Per base unit, for the value only. */
  rate: number;
  description: string | null;
}

export interface ChallanView {
  id: string;
  number: string;
  date: string;
  partyId: string;
  partyName: string;
  godownId: string;
  godownName: string;
  quotation: { id: string; number: string } | null;
  status: ChallanStatusView;
  invoice: { id: string; number: string } | null;
  shipToLine: string | null;
  shipToCity: string | null;
  vehicleNumber: string | null;
  notes: string | null;
  value: number;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdBy: string | null;
  lines: ChallanLineView[];
}
