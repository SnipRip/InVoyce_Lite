// Backend shapes of GET /reports/item-summary/:itemId (backend/src/reports/item-summary.service.ts).

export type LotKind = "bill" | "opening" | "adjustment" | "creditNote";
export type LotStatus = "In stock" | "Partly sold" | "Sold out" | "Gone";

export interface LotSaleView {
  date: string;
  invoiceId: string;
  invoice: string;
  customer: string;
  quantity: number;
  sales: number;
  cost: number;
}

export interface LotView {
  key: string;
  kind: LotKind;
  sourceId: string | null;
  label: string;
  party: string | null;
  date: string | null;
  godown: string;
  received: number;
  landedRate: number;
  sold: number;
  returned: number;
  writtenOff: number;
  remaining: number;
  sales: number;
  costOfSales: number;
  profit: number;
  marginPct: number | null;
  saleRate: number | null;
  status: LotStatus;
  saleSlices: LotSaleView[];
}

export interface RatePoint {
  date: string;
  kind: "purchase" | "sale" | "list";
  rate: number;
  billRate: number | null;
  quantity: number | null;
  party: string | null;
  number: string | null;
  href: string | null;
}

export interface MonthRow {
  month: string;
  purchased: number;
  purchaseValue: number;
  sold: number;
  sales: number;
  costOfSales: number;
  profit: number;
  marginPct: number | null;
}

export interface PartyTotal {
  party: string;
  documents: number;
  quantity: number;
  value: number;
  profit: number;
  averageRate: number | null;
  lastDate: string;
  lastRate: number | null;
}

export interface ItemSummaryView {
  item: {
    id: string;
    name: string;
    sku: string | null;
    unit: string;
    category: string;
    subCategory: string | null;
    brand: string | null;
    hsn: string;
    mrp: number | null;
    reorderLevel: number;
    isArchived: boolean;
  };
  stock: {
    onHand: number;
    value: number;
    averageCost: number | null;
    lastLandedCost: number | null;
    onChallans: number;
    free: number;
    status: string;
    byGodown: { godown: string; quantity: number; value: number }[];
    soldLast90Days: number;
    daysOfStock: number | null;
  };
  prices: {
    listRate: number | null;
    listMinimum: number | null;
    listMarginPct: number | null;
    lastSaleRate: number | null;
    lastSaleDate: string | null;
    lastPurchaseRate: number | null;
    lastPurchaseDate: string | null;
    averageSaleRate: number | null;
    averagePurchaseRate: number | null;
    lowestSaleRate: number | null;
    highestSaleRate: number | null;
  };
  totals: {
    purchased: number;
    purchaseValue: number;
    sold: number;
    sales: number;
    costOfSales: number;
    profit: number;
    marginPct: number | null;
    salesReturns: number;
    returnedByCustomers: number;
    returnedToVendors: number;
    writtenOff: number;
  };
  lots: LotView[];
  rates: RatePoint[];
  months: MonthRow[];
  customers: PartyTotal[];
  vendors: PartyTotal[];
}

export const ITEM_SUMMARY_ROUTE = "/reports/item-summary";
export const itemSummaryPath = (itemId: string) => `/reports/item-summary/${itemId}`;
