import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { addDays, formatDate, isoDate, todayInIndia } from '../common/dates.js';
import { toNumber } from '../common/decimal.js';
import { canAccess } from '../common/guards/access.guard.js';
import type { AuthContext } from '../common/types/authenticated-request.js';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { itemCostSource, itemCosts, stockOnHand, stockValue } from '../items/item-costs.js';
import { inherited } from '../items/item-rules.js';
import { priceInForce } from '../price-list/price-list-rules.js';
import {
  buildLots,
  daysOfStock,
  marginOn,
  monthRows,
  partyTotals,
  shareLineSales,
  type LotOut,
  type LotSale,
  type LotSource,
  type LotView,
  type MonthRow,
  type PartyTotal,
} from './item-summary-rules.js';
import { ITEM_SUMMARY_SOURCES, paise, REPORTS_MODULE, stockStatus } from './report-rules.js';

/** One rate the item was bought, sold or listed at, for the rate chart and table. */
export interface RatePoint {
  date: string;
  kind: 'purchase' | 'sale' | 'list';
  /** Purchase: landed rate; sale: taxable value per unit; list: the day's selling price. */
  rate: number;
  /** Purchase: the bill rate after discount, before freight and charges. */
  billRate: number | null;
  quantity: number | null;
  party: string | null;
  number: string | null;
  href: string | null;
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
    pictureId: string | null;
    isArchived: boolean;
  };
  stock: {
    onHand: number;
    value: number;
    averageCost: number | null;
    lastLandedCost: number | null;
    onChallans: number;
    /** On hand less what open challans hold. */
    free: number;
    status: string;
    byGodown: { godown: string; quantity: number; value: number }[];
    soldLast90Days: number;
    daysOfStock: number | null;
  };
  prices: {
    /** The price list entry in force today, if any. */
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
    /** Credit notes with GST: value taken off sales, and units that came back. */
    salesReturns: number;
    returnedByCustomers: number;
    returnedToVendors: number;
    writtenOff: number;
  };
  lots: LotView[];
  /** Oldest first. */
  rates: RatePoint[];
  months: MonthRow[];
  customers: PartyTotal[];
  vendors: PartyTotal[];
}

const n = (value: Prisma.Decimal | null) => toNumber(value) ?? 0;
const qty = (value: number) => Math.round(value * 1000) / 1000;
const named = { select: { name: true } } as const;
const unitOf = { defaultUnit: { select: { symbol: true } } } as const;
const party = { select: { displayName: true } } as const;
/** Sales over this many days set the pace for "days of stock". */
const PACE_DAYS = 90;
const openingKey = (godownId: string) => `opening:${godownId}`;

// The item summary report (client, 13 Nov 2026): pick an item and see
// everything about it in one place. Read-only; the figures follow the same
// rules as the item-wise profit report (each sold slice at the cost of the
// lot it was drawn from) and the stock summary (FIFO value of what is left).
@Injectable()
export class ItemSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(auth: AuthContext, itemId: string): Promise<ItemSummaryView> {
    if (![REPORTS_MODULE, ...ITEM_SUMMARY_SOURCES].every((module) => canAccess(auth, module, 'view'))) {
      throw new ForbiddenException('Your role does not allow this report');
    }
    const item = await this.prisma.item.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        name: true,
        sku: true,
        hsn: true,
        mrp: true,
        reorderLevel: true,
        isArchived: true,
        primaryPictureId: true,
        pictures: { select: { id: true }, orderBy: { createdAt: 'asc' }, take: 1 },
        ...itemCostSource,
        unit: { select: { symbol: true } },
        brand: named,
        group: { select: unitOf },
        category: { select: { name: true, ...unitOf } },
        subCategory: { select: { name: true, ...unitOf } },
      },
    });
    if (!item) throw new NotFoundException('There is no such item');

    const [godowns, openings, batches, draws, writeOffs, vendorReturns, billLines, saleLines, creditLines, prices, challans] = await Promise.all([
      this.prisma.godown.findMany({ select: { id: true, name: true } }),
      this.prisma.itemOpeningStock.findMany({ where: { itemId }, select: { godownId: true, quantity: true, value: true, drawn: true } }),
      this.prisma.stockBatch.findMany({
        where: { itemId },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          date: true,
          quantity: true,
          remaining: true,
          landedRate: true,
          godownId: true,
          sourceBatchId: true,
          billLine: { select: { bill: { select: { id: true, reference: true, vendor: party } } } },
          transferLine: { select: { transfer: { select: { fromGodownId: true } } } },
          adjustmentLine: { select: { adjustment: { select: { id: true, number: true } } } },
          creditNoteLine: { select: { creditNote: { select: { id: true, number: true, party } } } },
        },
      }),
      this.prisma.invoiceStockDraw.findMany({
        where: { invoiceLine: { itemId, invoice: { status: 'ISSUED' } } },
        select: {
          batchId: true,
          quantity: true,
          rate: true,
          invoiceLine: { select: { id: true, quantity: true, taxable: true, invoice: { select: { id: true, number: true, date: true, godownId: true, party } } } },
        },
      }),
      this.prisma.stockMoveDraw.findMany({
        where: { adjustmentLine: { itemId, adjustment: { status: 'POSTED', direction: 'OUT' } } },
        select: { batchId: true, quantity: true, rate: true, adjustmentLine: { select: { adjustment: { select: { godownId: true } } } } },
      }),
      this.prisma.debitNoteLine.findMany({
        where: { itemId, quantity: { gt: 0 }, debitNote: { cancelledAt: null } },
        select: { batchId: true, quantity: true, cost: true },
      }),
      this.prisma.purchaseBillLine.findMany({
        where: { itemId, bill: { status: 'OPEN' } },
        select: { quantity: true, rate: true, discountPct: true, landedRate: true, landedCost: true, bill: { select: { id: true, reference: true, date: true, vendor: party } } },
      }),
      this.prisma.invoiceLine.findMany({
        where: { itemId, invoice: { status: 'ISSUED' } },
        select: { quantity: true, taxable: true, invoice: { select: { id: true, number: true, date: true, party } } },
      }),
      this.prisma.creditNoteLine.findMany({
        where: { itemId, creditNote: { cancelledAt: null, gstAdjusted: true } },
        select: { quantity: true, taxable: true },
      }),
      this.prisma.itemPrice.findMany({
        where: { itemId, isArchived: false },
        select: { id: true, itemId: true, validFrom: true, validTill: true, sellingPrice: true, mrp: true, minSellingPrice: true, costPrice: true, isArchived: true, updatedAt: true },
      }),
      this.prisma.deliveryChallanLine.aggregate({ where: { itemId, challan: { status: 'OPEN' } }, _sum: { quantity: true } }),
    ]);
    const godownName = new Map(godowns.map((godown) => [godown.id, godown.name]));

    // Each batch belongs to the lot it first came in with: a transfer's batch to
    // the batch it was moved from, or to the opening stock it was moved out of.
    const byId = new Map(batches.map((batch) => [batch.id, batch]));
    const lotOf = new Map<string, string>();
    const rootOf = (id: string): string => {
      const known = lotOf.get(id);
      if (known) return known;
      const batch = byId.get(id);
      let lot = id;
      if (batch?.sourceBatchId) lot = rootOf(batch.sourceBatchId);
      else if (batch?.transferLine) lot = openingKey(batch.transferLine.transfer.fromGodownId);
      lotOf.set(id, lot);
      return lot;
    };
    const lotFor = (batchId: string | null, godownId: string) => (batchId ? rootOf(batchId) : openingKey(godownId));

    const sources: LotSource[] = [
      ...openings.map((row) => ({
        key: openingKey(row.godownId),
        kind: 'opening' as const,
        sourceId: null,
        label: 'Opening stock',
        party: null,
        date: null,
        godown: godownName.get(row.godownId) ?? '',
        received: n(row.quantity),
        landedRate: n(row.quantity) > 0 ? paise(n(row.value) / n(row.quantity)) : 0,
      })),
      ...batches
        .filter((batch) => !batch.sourceBatchId && !batch.transferLine)
        .map((batch) => {
          const bill = batch.billLine?.bill;
          const note = batch.creditNoteLine?.creditNote;
          const adjustment = batch.adjustmentLine?.adjustment;
          return {
            key: batch.id,
            kind: bill ? ('bill' as const) : note ? ('creditNote' as const) : ('adjustment' as const),
            sourceId: bill?.id ?? note?.id ?? adjustment?.id ?? null,
            label: bill?.reference ?? note?.number ?? adjustment?.number ?? 'Stock added',
            party: bill?.vendor.displayName ?? note?.party.displayName ?? null,
            date: isoDate(batch.date),
            godown: godownName.get(batch.godownId) ?? '',
            received: n(batch.quantity),
            landedRate: n(batch.landedRate),
          };
        }),
    ];

    const remainingByLot = new Map<string, number>();
    const addLeft = (key: string, amount: number) => remainingByLot.set(key, (remainingByLot.get(key) ?? 0) + amount);
    for (const row of openings) addLeft(openingKey(row.godownId), n(row.quantity) - n(row.drawn));
    for (const batch of batches) addLeft(rootOf(batch.id), n(batch.remaining));

    const sortedDraws = draws.sort(
      (a, b) => a.invoiceLine.invoice.date.getTime() - b.invoiceLine.invoice.date.getTime() || a.invoiceLine.invoice.number.localeCompare(b.invoiceLine.invoice.number),
    );
    const sales: LotSale[] = shareLineSales(
      sortedDraws.map((draw) => ({ draw, lineId: draw.invoiceLine.id, lineQuantity: n(draw.invoiceLine.quantity), lineTaxable: n(draw.invoiceLine.taxable), quantity: n(draw.quantity) })),
    ).map(({ draw, sales: value, quantity }) => {
      const invoice = draw.invoiceLine.invoice;
      return {
        lotKey: lotFor(draw.batchId, invoice.godownId),
        date: isoDate(invoice.date),
        invoiceId: invoice.id,
        invoice: invoice.number,
        customer: invoice.party.displayName,
        quantity,
        sales: value,
        cost: paise(quantity * n(draw.rate)),
      };
    });
    const outs: LotOut[] = [
      ...writeOffs.map((draw) => ({ lotKey: lotFor(draw.batchId, draw.adjustmentLine?.adjustment.godownId ?? ''), kind: 'writtenOff' as const, quantity: n(draw.quantity), value: paise(n(draw.quantity) * n(draw.rate)) })),
      ...vendorReturns.filter((line) => line.batchId).map((line) => ({ lotKey: rootOf(line.batchId!), kind: 'returned' as const, quantity: n(line.quantity), value: n(line.cost) })),
    ];
    const lots = buildLots(sources, remainingByLot, sales, outs);

    // Rates over time: every bill line, every invoice line and every price list entry.
    const rates: RatePoint[] = [
      ...billLines.map((line) => ({
        date: isoDate(line.bill.date),
        kind: 'purchase' as const,
        rate: paise(n(line.landedRate)),
        billRate: paise(n(line.rate) * (1 - n(line.discountPct) / 100)),
        quantity: n(line.quantity),
        party: line.bill.vendor.displayName,
        number: line.bill.reference,
        href: `/purchases/${line.bill.id}`,
      })),
      ...saleLines
        .filter((line) => n(line.quantity) > 0)
        .map((line) => ({
          date: isoDate(line.invoice.date),
          kind: 'sale' as const,
          rate: paise(n(line.taxable) / n(line.quantity)),
          billRate: null,
          quantity: n(line.quantity),
          party: line.invoice.party.displayName,
          number: line.invoice.number,
          href: `/invoices/${line.invoice.id}`,
        })),
      ...prices.map((entry) => ({
        date: isoDate(entry.validFrom),
        kind: 'list' as const,
        rate: n(entry.sellingPrice),
        billRate: null,
        quantity: null,
        party: null,
        number: entry.validFrom.getTime() === entry.validTill.getTime() ? null : `till ${formatDate(isoDate(entry.validTill))}`,
        href: null,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    const today = todayInIndia();
    const facts = prices.map((entry) => ({
      id: entry.id,
      itemId: entry.itemId,
      validFrom: isoDate(entry.validFrom),
      validTill: isoDate(entry.validTill),
      sellingPrice: n(entry.sellingPrice),
      mrp: toNumber(entry.mrp),
      minSellingPrice: toNumber(entry.minSellingPrice),
      costPrice: toNumber(entry.costPrice),
      isArchived: entry.isArchived,
      updatedAt: entry.updatedAt.toISOString(),
    }));
    const listEntry = priceInForce(facts, today);

    const onHand = stockOnHand(item);
    const costs = itemCosts(item);
    const onChallans = n(challans._sum.quantity);
    const since = addDays(today, -PACE_DAYS);
    const soldLately = qty(sales.filter((sale) => sale.date > since).reduce((sum, sale) => sum + sale.quantity, 0));

    const purchaseRates = rates.filter((point) => point.kind === 'purchase');
    const saleRates = rates.filter((point) => point.kind === 'sale');
    const weighted = (points: RatePoint[]) => {
      const units = points.reduce((sum, point) => sum + (point.quantity ?? 0), 0);
      return units > 0 ? paise(points.reduce((sum, point) => sum + point.rate * (point.quantity ?? 0), 0) / units) : null;
    };
    const lastPurchase = purchaseRates.at(-1);
    const lastSale = saleRates.at(-1);

    const totalSales = paise(sales.reduce((sum, sale) => sum + sale.sales, 0));
    const totalCost = paise(sales.reduce((sum, sale) => sum + sale.cost, 0));
    const salesReturns = paise(creditLines.reduce((sum, line) => sum + n(line.taxable), 0));

    return {
      item: {
        id: item.id,
        name: item.name,
        sku: item.sku,
        unit: inherited(item.unit?.symbol, item.group?.defaultUnit?.symbol, item.subCategory?.defaultUnit?.symbol, item.category.defaultUnit?.symbol) ?? '',
        category: item.category.name,
        subCategory: item.subCategory?.name ?? null,
        brand: item.brand?.name ?? null,
        hsn: item.hsn,
        mrp: toNumber(item.mrp),
        reorderLevel: n(item.reorderLevel),
        pictureId: item.primaryPictureId ?? item.pictures[0]?.id ?? null,
        isArchived: item.isArchived,
      },
      stock: {
        onHand,
        value: stockValue(item),
        averageCost: costs.stockCost,
        lastLandedCost: costs.lastLandedCost,
        onChallans,
        free: qty(onHand - onChallans),
        status: stockStatus(onHand, n(item.reorderLevel)),
        byGodown: godownStock(item, godownName),
        soldLast90Days: soldLately,
        daysOfStock: daysOfStock(onHand, soldLately, PACE_DAYS),
      },
      prices: {
        listRate: listEntry?.sellingPrice ?? null,
        listMinimum: listEntry?.minSellingPrice ?? null,
        listMarginPct: listEntry ? marginOn(listEntry.sellingPrice, listEntry.costPrice ?? costs.lastLandedCost ?? 0) : null,
        lastSaleRate: lastSale?.rate ?? null,
        lastSaleDate: lastSale?.date ?? null,
        lastPurchaseRate: lastPurchase?.rate ?? null,
        lastPurchaseDate: lastPurchase?.date ?? null,
        averageSaleRate: weighted(saleRates),
        averagePurchaseRate: weighted(purchaseRates),
        lowestSaleRate: saleRates.length ? Math.min(...saleRates.map((point) => point.rate)) : null,
        highestSaleRate: saleRates.length ? Math.max(...saleRates.map((point) => point.rate)) : null,
      },
      totals: {
        purchased: qty(billLines.reduce((sum, line) => sum + n(line.quantity), 0)),
        purchaseValue: paise(billLines.reduce((sum, line) => sum + n(line.landedCost), 0)),
        sold: qty(sales.reduce((sum, sale) => sum + sale.quantity, 0)),
        sales: totalSales,
        costOfSales: totalCost,
        profit: paise(totalSales - totalCost),
        marginPct: marginOn(totalSales, totalCost),
        salesReturns,
        returnedByCustomers: qty(lots.filter((lot) => lot.kind === 'creditNote').reduce((sum, lot) => sum + lot.received, 0)),
        returnedToVendors: qty(outs.filter((out) => out.kind === 'returned').reduce((sum, out) => sum + out.quantity, 0)),
        writtenOff: qty(outs.filter((out) => out.kind === 'writtenOff').reduce((sum, out) => sum + out.quantity, 0)),
      },
      lots,
      rates,
      months: monthRows(
        billLines.map((line) => ({ date: isoDate(line.bill.date), quantity: n(line.quantity), value: n(line.landedCost) })),
        sales,
      ),
      customers: partyTotals(sales.map((sale) => ({ party: sale.customer, document: sale.invoiceId, date: sale.date, quantity: sale.quantity, value: sale.sales, profit: paise(sale.sales - sale.cost), rate: null }))).map(
        (row) => ({ ...row, lastRate: saleRates.filter((point) => point.party === row.party).at(-1)?.rate ?? null }),
      ),
      vendors: partyTotals(
        billLines.map((line) => ({ party: line.bill.vendor.displayName, document: line.bill.id, date: isoDate(line.bill.date), quantity: n(line.quantity), value: n(line.landedCost), rate: paise(n(line.landedRate)) })),
      ),
    };
  }
}

/** Stock and its FIFO value in each godown that holds some. */
function godownStock(
  item: { openingStock: { godownId: string; quantity: Prisma.Decimal; value: Prisma.Decimal; drawn: Prisma.Decimal }[]; stockBatches: { godownId: string; remaining: Prisma.Decimal; landedRate: Prisma.Decimal }[] },
  names: Map<string, string>,
): { godown: string; quantity: number; value: number }[] {
  const held = new Map<string, { quantity: number; value: number }>();
  const add = (godownId: string, quantity: number, value: number) => {
    const entry = held.get(godownId) ?? { quantity: 0, value: 0 };
    held.set(godownId, { quantity: entry.quantity + quantity, value: entry.value + value });
  };
  for (const row of item.openingStock) {
    const left = n(row.quantity) - n(row.drawn);
    add(row.godownId, left, n(row.quantity) > 0 ? (n(row.value) * left) / n(row.quantity) : 0);
  }
  for (const batch of item.stockBatches) add(batch.godownId, n(batch.remaining), n(batch.remaining) * n(batch.landedRate));
  return [...held]
    .filter(([, entry]) => entry.quantity > 0.0005)
    .map(([godownId, entry]) => ({ godown: names.get(godownId) ?? '', quantity: qty(entry.quantity), value: paise(entry.value) }))
    .sort((a, b) => b.quantity - a.quantity);
}
