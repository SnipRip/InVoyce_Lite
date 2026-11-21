// Actual profit: sales before GST less the FIFO cost of the goods less the
// expenses booked on the sale, cut by invoice, customer and item. Pure: the
// service loads the facts.
//
// - Sales and cost come from the issued invoice (taxable value, cost of the
//   batches its lines drew); item-cost expenses are already inside that cost
//   through the bill's landed rate, so they are never counted again.
// - An invoice's own expenses are spread over its lines by value.
// - Every view adds up to the same total.
// - Overheads belong to no sale: they come off once, as net profit.

const money = (value: number) => Math.round(value * 100) / 100;

/** Sales, cost, expenses, profit and margin of a set of sales. */
export interface Profit {
  sales: number;
  cost: number;
  /** Expenses booked on the sales (their cost: amount plus GST not claimable). */
  expenses: number;
  profit: number;
  marginPct: number;
}

export function profitOf(invoices: { taxable: number; cost: number }[], expenseCosts: number[]): Profit {
  const sales = money(invoices.reduce((sum, invoice) => sum + invoice.taxable, 0));
  const cost = money(invoices.reduce((sum, invoice) => sum + invoice.cost, 0));
  const expenses = money(expenseCosts.reduce((sum, value) => sum + value, 0));
  const profit = money(sales - cost - expenses);
  return { sales, cost, expenses, profit, marginPct: sales ? Math.round((profit / sales) * 10_000) / 100 : 0 };
}

export interface ProfitLine {
  itemId: string;
  itemName: string;
  sku: string | null;
  taxable: number;
  costOfGoods: number;
}

export interface ProfitInvoice {
  id: string;
  number: string;
  date: string;
  partyId: string;
  partyName: string;
  taxable: number;
  cost: number;
  lines: ProfitLine[];
  /** Set on a credit note in the period against an invoice from before it: a negative sale of its own. */
  creditNoteOf?: string;
}

export interface ProfitExpense {
  id: string;
  date: string;
  headName: string;
  /** Amount plus GST that cannot be claimed. */
  cost: number;
  allocation: 'ITEM_COST' | 'INVOICE' | 'OVERHEAD';
  invoiceId: string | null;
}

export interface ProfitRow extends Profit {
  key: string;
  label: string;
  detail: string | null;
  /** Where the row links to: invoice, customer or item page. */
  kind: 'invoice' | 'creditNote' | 'customer' | 'item' | null;
}

export interface HeadTotal {
  head: string;
  amount: number;
  count: number;
}

export interface ProfitReport {
  byInvoice: ProfitRow[];
  byCustomer: ProfitRow[];
  byItem: ProfitRow[];
  total: Profit;
  overheads: { total: number; byHead: HeadTotal[] };
  netProfit: number;
}

/** Splits `amount` over `weights` in proportion; the last share takes the rounding so they add up. */
export function shareByValue(amount: number, weights: number[]): number[] {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (!total) return weights.map(() => 0);
  let given = 0;
  return weights.map((weight, index) => {
    const share = index === weights.length - 1 ? money(amount - given) : money((amount * weight) / total);
    given = money(given + share);
    return share;
  });
}

const sum = (values: number[]) => money(values.reduce((total, value) => total + value, 0));

/** Profit of a set of sales with the expenses each carries. */
interface Slice {
  sales: { taxable: number; cost: number };
  expenses: number;
}

const profitOfSlices = (slices: Slice[]) =>
  profitOf(
    slices.map((slice) => slice.sales),
    slices.map((slice) => slice.expenses),
  );

function groupRows<K>(entries: { key: K; slice: Slice }[]): Map<K, Slice[]> {
  const groups = new Map<K, Slice[]>();
  for (const { key, slice } of entries) groups.set(key, [...(groups.get(key) ?? []), slice]);
  return groups;
}

export function buildProfitReport(invoices: ProfitInvoice[], expenses: ProfitExpense[], overheadExpenses: ProfitExpense[]): ProfitReport {
  const expensesOn = (invoice: ProfitInvoice) =>
    sum(expenses.filter((expense) => expense.allocation === 'INVOICE' && expense.invoiceId === invoice.id).map((expense) => expense.cost));

  const invoiceSlices = invoices.map((invoice) => ({
    invoice,
    slice: { sales: { taxable: invoice.taxable, cost: invoice.cost }, expenses: expensesOn(invoice) },
  }));

  const byInvoice: ProfitRow[] = invoiceSlices.map(({ invoice, slice }) => ({
    key: invoice.id,
    label: invoice.number,
    detail: invoice.creditNoteOf ? `${invoice.partyName} · return against ${invoice.creditNoteOf}` : invoice.partyName,
    kind: invoice.creditNoteOf ? 'creditNote' : 'invoice',
    ...profitOfSlices([slice]),
  }));

  const customers = groupRows(invoiceSlices.map(({ invoice, slice }) => ({ key: invoice.partyId, slice })));
  const byCustomer: ProfitRow[] = [...customers].map(([partyId, slices]) => ({
    key: partyId,
    label: invoices.find((invoice) => invoice.partyId === partyId)?.partyName ?? '',
    detail: `${slices.length} invoice${slices.length === 1 ? '' : 's'}`,
    kind: 'customer',
    ...profitOfSlices(slices),
  }));

  // An invoice's expenses over its lines by value.
  const lineEntries = invoiceSlices.flatMap(({ invoice, slice }) => {
    const shares = shareByValue(
      slice.expenses,
      invoice.lines.map((line) => line.taxable),
    );
    return invoice.lines.map((line, index) => ({
      line,
      slice: { sales: { taxable: line.taxable, cost: line.costOfGoods }, expenses: shares[index] ?? 0 },
    }));
  });
  const items = groupRows(lineEntries.map(({ line, slice }) => ({ key: line.itemId, slice })));
  const byItem: ProfitRow[] = [...items].map(([itemId, slices]) => {
    const line = lineEntries.find((entry) => entry.line.itemId === itemId)?.line;
    return { key: itemId, label: line?.itemName ?? '', detail: line?.sku ?? null, kind: 'item', ...profitOfSlices(slices) };
  });

  const total = profitOfSlices(invoiceSlices.map(({ slice }) => slice));
  const heads = new Map<string, HeadTotal>();
  for (const expense of overheadExpenses) {
    const row = heads.get(expense.headName) ?? { head: expense.headName, amount: 0, count: 0 };
    heads.set(expense.headName, { ...row, amount: money(row.amount + expense.cost), count: row.count + 1 });
  }
  const overheadTotal = sum(overheadExpenses.map((expense) => expense.cost));

  return {
    byInvoice,
    byCustomer,
    byItem,
    total,
    overheads: { total: overheadTotal, byHead: [...heads.values()].sort((a, b) => b.amount - a.amount) },
    netProfit: money(total.profit - overheadTotal),
  };
}
