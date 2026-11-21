// GET /dashboard (backend/src/dashboard/dashboard-views.ts). A section is null
// when the user's role may not open the screen it comes from.
import type { DispatchDocumentKindView } from "./invoice";
import type { QuotationStatusView } from "./quotation";
import type { SettlementDirectionView, SettlementTargetView } from "./settlement";

export interface DashboardDueView {
  direction: SettlementDirectionView;
  kind: SettlementTargetView;
  id: string;
  partyId: string;
  partyName: string;
  number: string;
  balance: number;
  /** Receivable: when it falls due. MSME bill: the last day under the 45-day rule. */
  dueDate: string;
}

export interface DashboardView {
  /** This financial year to today. */
  from: string;
  to: string;
  /** Mondays of the chart's weeks, oldest first; each `byWeek` has one figure per week. */
  weeks: string[];
  sales: { total: number; invoices: number; byWeek: number[] } | null;
  purchases: { total: number; bills: number; vendors: number; byWeek: number[]; untaggedCharges: number } | null;
  profit: {
    sales: number;
    cost: number;
    expenses: number;
    profit: number;
    marginPct: number;
    overheads: number;
    /** Overheads plus loan interest, bank charges, stock written off and other indirect expenses in the books. */
    indirectExpenses: number;
    indirectIncome: number;
    /** Profit after every expense, direct and indirect, plus indirect income. */
    netProfit: number;
    byWeek: number[];
  } | null;
  outstanding: { receivable: number; openInvoices: number; payable: number; dues: DashboardDueView[] } | null;
  documents: { missing: number; first: { kind: DispatchDocumentKindView; invoiceNumber: string }[] } | null;
  stock: { low: number; first: string[] } | null;
  quotations: { id: string; number: string; revision: number; partyName: string; total: number; validUntil: string; status: QuotationStatusView }[] | null;
}
