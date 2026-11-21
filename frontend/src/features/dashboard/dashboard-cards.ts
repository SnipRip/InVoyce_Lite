// Turns the backend's dashboard summary into what each card shows. Pure, no
// clock: anything that depends on today (overdue, MSME days, expired
// quotations) is decided in the card from `useToday`.
import { quotationLabel } from "@/features/quotations/quotation-rules";
import type { QuotationStatus } from "@/features/quotations/types";
import { documentName } from "@/features/documents/documents-api";
import { formatDayMonth, formatInr } from "@/lib/format";
import type { DashboardView } from "@/types/dashboard";
import type { AttentionItem, Kpi, PendingQuotation, TradingSeries, TradingWeek } from "./types";

const lakh = (amount: number) => Math.round(amount / 1000) / 100;
const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
const andMore = (names: string[], total: number) => names.join(", ") + (total > names.length ? ` and ${total - names.length} more` : "");

export function dashboardKpis(view: DashboardView): Kpi[] {
  const kpis: (Kpi | false)[] = [
    !!view.sales && {
      label: "Sales",
      value: view.sales.total,
      note: `${plural(view.sales.invoices, "invoice")} · before GST`,
      noteTone: "neutral",
      href: "/invoices",
    },
    !!view.purchases && {
      label: "Purchases",
      value: view.purchases.total,
      note: `${plural(view.purchases.bills, "goods bill")} from ${plural(view.purchases.vendors, "vendor")} · before GST`,
      noteTone: "neutral",
      href: "/purchases",
    },
    !!view.profit && {
      // Net of direct and indirect expenses, with indirect income added (client, 12 Nov 2026).
      label: "Actual profit",
      value: view.profit.netProfit,
      note: `After ${formatInr(view.profit.expenses)} direct, ${formatInr(view.profit.indirectExpenses)} indirect expenses · ${formatInr(view.profit.indirectIncome)} other income`,
      noteTone: view.profit.netProfit < 0 ? "danger" : "success",
      href: "/profit",
    },
    !!view.outstanding && {
      label: "Receivable",
      value: view.outstanding.receivable,
      note: `${plural(view.outstanding.openInvoices, "invoice")} open · ${formatInr(view.outstanding.payable)} we owe vendors`,
      noteTone: "neutral",
      href: "/payments",
    },
  ];
  return kpis.filter((kpi): kpi is Kpi => kpi !== false);
}

/** The series the user may see, and one bar group per week. */
export function tradingWeeks(view: DashboardView): { series: TradingSeries[]; weeks: TradingWeek[] } {
  const sources: [TradingSeries, number[] | undefined][] = [
    ["sales", view.sales?.byWeek],
    ["purchase", view.purchases?.byWeek],
    ["profit", view.profit?.byWeek],
  ];
  const shown = sources.filter((source): source is [TradingSeries, number[]] => !!source[1]);
  return {
    series: shown.map(([key]) => key),
    weeks: view.weeks.map((week, index) => ({
      week: formatDayMonth(week),
      ...Object.fromEntries(shown.map(([key, values]) => [key, lakh(values[index])])),
    })),
  };
}

/** Alerts that do not depend on today: papers, stock, landed cost, overheads. */
export function attentionItems(view: DashboardView): AttentionItem[] {
  const { documents, stock, purchases, profit } = view;
  const items: (AttentionItem | false)[] = [
    !!documents?.missing && {
      heading: `Documents · ${documents.missing} required, not attached`,
      detail: andMore(
        documents.first.map((paper) => `${documentName(paper.kind)} on ${paper.invoiceNumber}`),
        documents.missing,
      ),
      tone: "warning",
      href: "/documents",
    },
    !!stock?.low && {
      heading: `Stock · ${plural(stock.low, "item")} at or below reorder level`,
      detail: andMore(stock.first, stock.low),
      tone: "warning",
      href: "/items",
    },
    !!purchases?.untaggedCharges && {
      heading: `Landed cost · ${plural(purchases.untaggedCharges, "freight or labour bill")} not tagged`,
      detail: "Tag them to their purchase so the cost lands on the items",
      tone: "warning",
      href: "/purchases",
    },
    !!profit && {
      heading: `Indirect expenses · ${formatInr(profit.indirectExpenses)} this year`,
      detail: `Rent, salary, interest and other costs: trading profit ${formatInr(profit.profit)}, net ${formatInr(profit.netProfit)}`,
      tone: "neutral",
      href: "/profit",
    },
  ];
  return items.filter((item): item is AttentionItem => item !== false);
}

export const pendingQuotations = (view: DashboardView): PendingQuotation[] =>
  (view.quotations ?? []).map((quotation) => ({
    id: quotation.id,
    label: quotationLabel(quotation),
    customer: quotation.partyName,
    value: quotation.total,
    validUntil: quotation.validUntil,
    status: quotation.status.toLowerCase() as QuotationStatus,
  }));

