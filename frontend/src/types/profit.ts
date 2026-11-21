// Actual profit as the backend returns it (GET /profit?from&to).

export interface ProfitView {
  sales: number;
  cost: number;
  expenses: number;
  profit: number;
  marginPct: number;
}

export type ProfitRowKind = "invoice" | "creditNote" | "customer" | "item";

export interface ProfitRowView extends ProfitView {
  key: string;
  label: string;
  detail: string | null;
  /** What the row links to. */
  kind: ProfitRowKind | null;
}

export interface ProfitReportView {
  from: string;
  to: string;
  byInvoice: ProfitRowView[];
  byCustomer: ProfitRowView[];
  byItem: ProfitRowView[];
  total: ProfitView;
  overheads: { total: number; byHead: { head: string; amount: number; count: number }[] };
  /** Indirect incomes from the books: interest received, stock found, incomes by journal. */
  otherIncome: number;
  /** Indirect expenses from the books outside the expense register: loan interest, bank charges, stock written off, overhead bills, journals. */
  otherExpenses: number;
  netProfit: number;
}
