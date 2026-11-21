// Every report the business reads (SOW 16): title, group, description and
// columns. The rows come from the backend (GET /reports/:id), keyed by these
// columns.
import type { Report } from "./types";

const salesRegister: Report = {
  id: "sales-register",
  title: "Sales register",
  group: "Sales",
  description: "Every issued invoice with its taxable value and GST heads.",
  period: true,
  partyKey: "customer",
  columns: [
    { key: "date", label: "Date", kind: "date" },
    { key: "number", label: "Invoice", kind: "text" },
    { key: "customer", label: "Customer", kind: "text" },
    { key: "gstin", label: "GSTIN / country", kind: "text" },
    { key: "taxable", label: "Taxable", kind: "money" },
    { key: "cgst", label: "CGST", kind: "money" },
    { key: "sgst", label: "SGST", kind: "money" },
    { key: "igst", label: "IGST", kind: "money" },
    { key: "total", label: "Total", kind: "money" },
  ],
};

const purchaseRegister: Report = {
  id: "purchase-register",
  title: "Purchase register",
  group: "Purchases",
  description: "Every vendor bill with GST, input credit and reverse charge.",
  period: true,
  partyKey: "vendor",
  columns: [
    { key: "date", label: "Date", kind: "date" },
    { key: "reference", label: "Bill", kind: "text" },
    { key: "vendorBill", label: "Vendor's no.", kind: "text" },
    { key: "vendor", label: "Vendor", kind: "text" },
    { key: "taxable", label: "Taxable", kind: "money" },
    { key: "tax", label: "GST", kind: "money" },
    { key: "itc", label: "Input credit", kind: "money" },
    { key: "rcm", label: "Reverse charge", kind: "money" },
    { key: "payable", label: "Payable", kind: "money" },
  ],
};

const gstSummary: Report = {
  id: "gst-summary",
  title: "GST summary (3B view)",
  group: "GST",
  description: "Output tax on sales, input credit on bills and expenses, reverse charge and what is left to pay, by head.",
  period: true,
  columns: [
    { key: "line", label: "", kind: "text" },
    { key: "cgst", label: "CGST", kind: "money", total: false },
    { key: "sgst", label: "SGST", kind: "money", total: false },
    { key: "igst", label: "IGST", kind: "money", total: false },
  ],
};

const hsnReport: Report = {
  id: "hsn-summary",
  title: "HSN summary of sales",
  group: "GST",
  description: "Outward supplies by HSN and rate, as GSTR-1 table 12 asks.",
  period: true,
  columns: [
    { key: "hsn", label: "HSN", kind: "text" },
    { key: "uqc", label: "UQC", kind: "text" },
    { key: "quantity", label: "Quantity", kind: "quantity" },
    { key: "rate", label: "Rate", kind: "percent" },
    { key: "taxable", label: "Taxable", kind: "money" },
    { key: "tax", label: "Tax", kind: "money" },
  ],
};

const stockSummary: Report = {
  id: "stock-summary",
  title: "Stock summary",
  group: "Stock",
  description: "Every item's stock, value at cost and reorder status.",
  period: false,
  columns: [
    { key: "sku", label: "SKU", kind: "text" },
    { key: "item", label: "Item", kind: "text" },
    { key: "stock", label: "In stock", kind: "quantity", total: false },
    { key: "unit", label: "Unit", kind: "text" },
    { key: "cost", label: "Stock cost", kind: "money", total: false },
    { key: "value", label: "Value", kind: "money" },
    { key: "status", label: "Status", kind: "text" },
  ],
};

const quotationReport: Report = {
  id: "quotations",
  title: "Quotation report",
  group: "Sales",
  description: "Quotations with value, margin and outcome.",
  period: true,
  partyKey: "customer",
  columns: [
    { key: "date", label: "Date", kind: "date" },
    { key: "number", label: "Quotation", kind: "text" },
    { key: "customer", label: "Customer", kind: "text" },
    { key: "value", label: "Value", kind: "money" },
    { key: "margin", label: "Margin", kind: "percent" },
    { key: "stage", label: "Stage", kind: "text" },
  ],
};

const expenseReport: Report = {
  id: "expenses",
  title: "Expenses by head",
  group: "Money",
  description: "What was spent under each head, before GST, and where it landed.",
  period: true,
  columns: [
    { key: "head", label: "Head", kind: "text" },
    { key: "group", label: "Ledger group", kind: "text" },
    { key: "count", label: "Entries", kind: "quantity" },
    { key: "amount", label: "Before GST", kind: "money" },
    { key: "gst", label: "GST", kind: "money" },
  ],
};

const outstandingReport: Report = {
  id: "outstanding",
  title: "Outstanding by party",
  group: "Money",
  description: "What each customer owes and what we owe each vendor.",
  period: false,
  partyKey: "party",
  columns: [
    { key: "party", label: "Party", kind: "text" },
    { key: "side", label: "Side", kind: "text" },
    { key: "documents", label: "Open documents", kind: "quantity" },
    { key: "balance", label: "Balance", kind: "money", total: false },
  ],
};

const placeOfSupplyReport: Report = {
  id: "sales-by-state",
  title: "Sales by place of supply",
  group: "GST",
  description: "Taxable sales by state, for the state-wise split in returns.",
  period: true,
  columns: [
    { key: "place", label: "Place of supply", kind: "text" },
    { key: "invoices", label: "Invoices", kind: "quantity" },
    { key: "taxable", label: "Taxable", kind: "money" },
  ],
};

const itemProfitReport: Report = {
  id: "item-profit",
  title: "Item-wise profit",
  group: "Sales",
  description: "Each item sold against the purchase it came from: bought from whom, when and at what landed rate; sold to whom, on which invoice; and the profit.",
  period: true,
  partyKey: "customer",
  columns: [
    { key: "date", label: "Sold on", kind: "date" },
    { key: "invoice", label: "Invoice", kind: "text" },
    { key: "customer", label: "Sold to", kind: "text" },
    { key: "item", label: "Item", kind: "text" },
    { key: "quantity", label: "Quantity", kind: "quantity" },
    { key: "saleRate", label: "Sale rate", kind: "money" },
    { key: "sales", label: "Sales", kind: "money" },
    { key: "boughtFrom", label: "Bought from", kind: "text" },
    { key: "boughtOn", label: "Bought on", kind: "date" },
    { key: "purchase", label: "Purchase", kind: "text" },
    { key: "landedRate", label: "Landed rate", kind: "money" },
    { key: "cost", label: "Cost", kind: "money" },
    { key: "profit", label: "Profit", kind: "money" },
    { key: "marginPct", label: "Margin", kind: "percent" },
  ],
};

const notesRegister: Report = {
  id: "notes-register",
  title: "Credit & debit notes",
  group: "GST",
  description: "Credit notes against invoices and debit notes against bills, with their GST heads (GSTR-1 table 9B).",
  period: true,
  partyKey: "party",
  columns: [
    { key: "date", label: "Date", kind: "date" },
    { key: "kind", label: "Note", kind: "text" },
    { key: "number", label: "Number", kind: "text" },
    { key: "party", label: "Party", kind: "text" },
    { key: "gstin", label: "GSTIN", kind: "text" },
    { key: "against", label: "Against", kind: "text" },
    { key: "reason", label: "Why", kind: "text" },
    { key: "taxable", label: "Taxable", kind: "money" },
    { key: "cgst", label: "CGST", kind: "money" },
    { key: "sgst", label: "SGST", kind: "money" },
    { key: "igst", label: "IGST", kind: "money" },
    { key: "total", label: "Total", kind: "money" },
  ],
};

const moneyColumns = (party: string): Report["columns"] => [
  { key: "date", label: "Date", kind: "date" },
  { key: "number", label: "Number", kind: "text" },
  { key: "party", label: party, kind: "text" },
  { key: "kind", label: "Kind", kind: "text" },
  { key: "mode", label: "Mode", kind: "text" },
  { key: "account", label: "Account", kind: "text" },
  { key: "reference", label: "Reference", kind: "text" },
  { key: "amount", label: "Amount", kind: "money" },
  { key: "tds", label: "TDS", kind: "money" },
  { key: "total", label: "Settled", kind: "money" },
];

const receiptRegister: Report = {
  id: "receipt-register",
  title: "Receipt register",
  group: "Money",
  description: "Every receipt from customers in the period: mode, account, reference and TDS.",
  period: true,
  partyKey: "party",
  columns: moneyColumns("Received from"),
};

const paymentRegister: Report = {
  id: "payment-register",
  title: "Payment register",
  group: "Money",
  description: "Every payment to vendors in the period: mode, account, reference and TDS deducted.",
  period: true,
  partyKey: "party",
  columns: moneyColumns("Paid to"),
};

// One item at a time on its own page (features/reports/item-summary), not a table of rows.
const itemSummary: Report = {
  id: "item-summary",
  title: "Item summary",
  group: "Stock",
  description: "Pick an item: stock, rate history chart, batch-wise rates and profit on what is sold, customers, vendors and every movement.",
  period: false,
  columns: [],
  href: "/reports/item-summary",
};

export const REPORTS: Report[] = [
  salesRegister,
  itemProfitReport,
  quotationReport,
  purchaseRegister,
  gstSummary,
  hsnReport,
  notesRegister,
  placeOfSupplyReport,
  stockSummary,
  itemSummary,
  expenseReport,
  receiptRegister,
  paymentRegister,
  outstandingReport,
];

export const findReport = (id: string) => REPORTS.find((report) => report.id === id);

/** Where a report opens: its own page, or the shared table viewer. */
export const reportHref = (report: Pick<Report, "id" | "href">) => report.href ?? `/reports/${report.id}`;
