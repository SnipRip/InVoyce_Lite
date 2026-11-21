import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { dateOnly, isoDate, todayInIndia } from '../common/dates.js';
import { toNumber } from '../common/decimal.js';
import { financialYearOf } from '../common/financial-year.js';
import { canAccess } from '../common/guards/access.guard.js';
import type { AuthContext } from '../common/types/authenticated-request.js';
import { HEAD_GROUPS } from '../account-heads/account-head-rules.js';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { itemCostSource, itemCosts, stockOnHand, stockValue } from '../items/item-costs.js';
import { inherited } from '../items/item-rules.js';
import { quotationLabel } from '../sale-pricing/sale-rules.js';
import { SettlementsService } from '../settlements/settlements.service.js';
import type { ReportQueryDto } from './dto/report-query.dto.js';
import {
  gstSummaryRows,
  hsnRows,
  isReportId,
  marginPct,
  paise,
  placeLabel,
  quotationStage,
  REPORT_SOURCES,
  REPORTS_MODULE,
  stockStatus,
  type ReportId,
  type ReportRow,
} from './report-rules.js';
import { batchSourceSelect, drawSource } from '../stock/draw-source.js';
import { shareLineSales } from './item-summary-rules.js';

export interface ReportView {
  /** The period the rows cover; null for a report of today's position (stock, outstanding). */
  from: string | null;
  to: string | null;
  rows: ReportRow[];
}

type Period = { gte: Date; lte: Date };

/** Reports that show where things stand today rather than a period. */
const AS_OF_TODAY: ReportId[] = ['stock-summary', 'outstanding'];

const unitOf = { defaultUnit: { select: { symbol: true } } } as const;
const n = toNumber;

// Reports & MIS (SOW 16): every report's rows worked out from stored
// documents. Totals come from what each document stored when it was saved
// (the same figures its own page shows); profit, outstanding and stock reuse
// the services behind those screens. A report is open only to a role that
// may view Reports and every screen its data comes from.
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settlements: SettlementsService,
  ) {}

  async report(auth: AuthContext, id: string, query: ReportQueryDto): Promise<ReportView> {
    if (!isReportId(id)) throw new NotFoundException('There is no such report');
    if (![REPORTS_MODULE, ...REPORT_SOURCES[id]].every((module) => canAccess(auth, module, 'view'))) {
      throw new ForbiddenException('Your role does not allow this report');
    }
    if (AS_OF_TODAY.includes(id)) return { from: null, to: null, rows: await this.rowsAsOfToday(id) };

    const to = query.to ?? todayInIndia();
    const from = query.from ?? `${financialYearOf(to).slice(0, 4)}-04-01`;
    if (from > to) throw new BadRequestException('The first day is after the last day');
    return { from, to, rows: await this.rowsForPeriod(id, { gte: dateOnly(from), lte: dateOnly(to) }) };
  }

  private rowsAsOfToday(id: ReportId): Promise<ReportRow[]> {
    return id === 'stock-summary' ? this.stockSummary() : this.outstanding();
  }

  private rowsForPeriod(id: ReportId, period: Period): Promise<ReportRow[]> {
    switch (id) {
      case 'sales-register':
        return this.salesRegister(period);
      case 'quotations':
        return this.quotations(period);
      case 'purchase-register':
        return this.purchaseRegister(period);
      case 'gst-summary':
        return this.gstSummary(period);
      case 'hsn-summary':
        return this.hsnSummary(period);
      case 'sales-by-state':
        return this.salesByState(period);
      case 'expenses':
        return this.expensesByHead(period);
      case 'item-profit':
        return this.itemProfit(period);
      case 'notes-register':
        return this.notesRegister(period);
      case 'receipt-register':
        return this.moneyRegister(period, 'RECEIPT');
      default:
        return this.moneyRegister(period, 'PAYMENT');
    }
  }

  /**
   * Every slice of stock sold in the period against the batch it came from
   * (client, 12 Nov 2026): sold when, to whom, at what rate; bought from whom,
   * when, at what landed rate; and the profit on it. Slices from opening
   * stock show as such. Sale value per unit is the line's taxable value
   * (after discounts and schemes) over the units charged; free units carry
   * cost but no sale value.
   */
  private async itemProfit(period: Period): Promise<ReportRow[]> {
    const draws = await this.prisma.invoiceStockDraw.findMany({
      where: { invoiceLine: { invoice: { status: 'ISSUED', date: period } } },
      select: {
        quantity: true,
        rate: true,
        invoiceLine: {
          select: {
            id: true,
            quantity: true,
            taxable: true,
            item: { select: { name: true, sku: true } },
            invoice: { select: { id: true, number: true, date: true, party: { select: { displayName: true } } } },
          },
        },
        batch: {
          select: {
            ...batchSourceSelect.select,
            billLine: { select: { bill: { select: { id: true, reference: true, vendor: { select: { displayName: true } } } } } },
          },
        },
      },
    });
    // Each line's sale value goes to its slices by the units charged (item-summary-rules).
    const sorted = draws.sort((a, b) => a.invoiceLine.invoice.date.getTime() - b.invoiceLine.invoice.date.getTime() || a.invoiceLine.invoice.number.localeCompare(b.invoiceLine.invoice.number));
    const rows = shareLineSales(
      sorted.map((draw) => ({ draw, lineId: draw.invoiceLine.id, lineQuantity: n(draw.invoiceLine.quantity), lineTaxable: n(draw.invoiceLine.taxable), quantity: n(draw.quantity) })),
    )
      .map(({ draw, sales }) => {
        const line = draw.invoiceLine;
        const sold = n(line.quantity);
        const saleRate = sold > 0 ? n(line.taxable) / sold : 0;
        const cost = paise(n(draw.quantity) * n(draw.rate));
        const source = drawSource(draw.batch);
        return {
          date: isoDate(line.invoice.date),
          invoice: line.invoice.number,
          customer: line.invoice.party.displayName,
          item: line.item.sku ? `${line.item.name} · ${line.item.sku}` : line.item.name,
          quantity: n(draw.quantity),
          saleRate: paise(saleRate),
          sales,
          boughtFrom: draw.batch?.billLine?.bill.vendor.displayName ?? source.label,
          boughtOn: draw.batch?.date ? isoDate(draw.batch.date) : '',
          purchase: draw.batch?.billLine?.bill.reference ?? source.label,
          landedRate: n(draw.rate),
          cost,
          profit: paise(sales - cost),
          marginPct: sales > 0 ? Math.round(((sales - cost) / sales) * 1000) / 10 : 0,
          href: `/invoices/${line.invoice.id}`,
        };
      });
    // Credit notes in the period take their value, and the cost of goods that
    // came back, off as negative rows dated on the note: the same rule as the
    // Profit page, so the two agree.
    const noteLines = await this.prisma.creditNoteLine.findMany({
      // Notes without GST are a discount (Discount Allowed, an indirect expense), not a lower sale.
      where: { creditNote: { cancelledAt: null, gstAdjusted: true, date: period } },
      select: {
        quantity: true,
        taxable: true,
        cost: true,
        item: { select: { name: true, sku: true } },
        creditNote: { select: { id: true, number: true, date: true, reason: true, party: { select: { displayName: true } }, invoice: { select: { number: true } } } },
      },
    });
    for (const line of noteLines) {
      const note = line.creditNote;
      const quantity = n(line.quantity);
      const sales = -paise(n(line.taxable));
      const cost = -paise(n(line.cost));
      rows.push({
        date: isoDate(note.date),
        invoice: `${note.number} (return of ${note.invoice.number})`,
        customer: note.party.displayName,
        item: line.item.sku ? `${line.item.name} · ${line.item.sku}` : line.item.name,
        quantity: -quantity,
        saleRate: quantity > 0 ? paise(n(line.taxable) / quantity) : 0,
        sales,
        boughtFrom: quantity > 0 ? 'Back into stock' : 'Value only',
        boughtOn: '',
        purchase: note.number,
        landedRate: quantity > 0 ? paise(n(line.cost) / quantity) : 0,
        cost,
        profit: paise(sales - cost),
        marginPct: 0,
        href: `/credit-notes/${note.id}`,
      });
    }
    return rows.sort((a, b) => a.date.localeCompare(b.date));
  }

  /** Receipts (or payments) in the period: who, how, through which account, and TDS. Refunds of advances are marked. */
  private async moneyRegister(period: Period, direction: 'RECEIPT' | 'PAYMENT'): Promise<ReportRow[]> {
    const rows = await this.prisma.settlement.findMany({
      where: { direction, cancelledAt: null, date: period },
      orderBy: [{ date: 'asc' }, { number: 'asc' }],
      select: {
        id: true,
        date: true,
        number: true,
        mode: true,
        amount: true,
        tds: true,
        reference: true,
        party: { select: { displayName: true } },
        account: { select: { name: true } },
        allocations: { where: { advanceId: { not: null } }, select: { id: true }, take: 1 },
      },
    });
    return rows.map((row) => ({
      date: isoDate(row.date),
      number: row.number,
      party: row.party.displayName,
      mode: row.mode.toLowerCase().replace(/_/g, ' '),
      account: row.account.name,
      reference: row.reference ?? '',
      amount: n(row.amount),
      tds: n(row.tds),
      total: paise(n(row.amount) + n(row.tds)),
      kind: row.allocations.length ? 'Refund' : direction === 'RECEIPT' ? 'Receipt' : 'Payment',
      href: `/payments/entries/${row.id}`,
    }));
  }

  /** Credit and debit notes dated in the period, with their GST heads. */
  private async notesRegister(period: Period): Promise<ReportRow[]> {
    const heads = { id: true, number: true, date: true, reason: true, gstAdjusted: true, taxable: true, cgst: true, sgst: true, igst: true, total: true, party: { select: { displayName: true, gstin: true } } } as const;
    const [credits, debits] = await Promise.all([
      this.prisma.creditNote.findMany({ where: { cancelledAt: null, date: period }, select: { ...heads, invoice: { select: { number: true } } } }),
      this.prisma.debitNote.findMany({ where: { cancelledAt: null, date: period }, select: { ...heads, bill: { select: { reference: true, vendorBillNumber: true } } } }),
    ]);
    const reason = (value: string, gstAdjusted: boolean) => `${value.toLowerCase().replace(/_/g, ' ')}${gstAdjusted ? '' : ' (without GST)'}`;
    return [
      ...credits.map((row) => ({
        date: isoDate(row.date),
        kind: 'Credit note',
        number: row.number,
        party: row.party.displayName,
        gstin: row.party.gstin ?? 'Unregistered',
        against: row.invoice.number,
        reason: reason(row.reason, row.gstAdjusted),
        taxable: n(row.taxable),
        cgst: n(row.cgst),
        sgst: n(row.sgst),
        igst: n(row.igst),
        total: n(row.total),
        href: `/credit-notes/${row.id}`,
      })),
      ...debits.map((row) => ({
        date: isoDate(row.date),
        kind: 'Debit note',
        number: row.number,
        party: row.party.displayName,
        gstin: row.party.gstin ?? 'Unregistered',
        against: `${row.bill.reference} (${row.bill.vendorBillNumber})`,
        reason: reason(row.reason, row.gstAdjusted),
        taxable: n(row.taxable),
        cgst: n(row.cgst),
        sgst: n(row.sgst),
        igst: n(row.igst),
        total: n(row.total),
        href: `/debit-notes/${row.id}`,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number));
  }

  private async salesRegister(period: Period): Promise<ReportRow[]> {
    const rows = await this.prisma.invoice.findMany({
      where: { status: 'ISSUED', date: period },
      orderBy: [{ date: 'asc' }, { number: 'asc' }],
      select: { id: true, date: true, number: true, destinationCountry: true, taxable: true, cgst: true, sgst: true, igst: true, total: true, party: { select: { displayName: true, gstin: true } } },
    });
    return rows.map((row) => ({
      date: isoDate(row.date),
      number: row.number,
      customer: row.party.displayName,
      gstin: row.party.gstin ?? row.destinationCountry ?? 'Unregistered',
      taxable: n(row.taxable),
      cgst: n(row.cgst),
      sgst: n(row.sgst),
      igst: n(row.igst),
      total: n(row.total),
      href: `/invoices/${row.id}`,
    }));
  }

  private async quotations(period: Period): Promise<ReportRow[]> {
    const rows = await this.prisma.quotation.findMany({
      where: { date: period },
      orderBy: [{ date: 'asc' }, { number: 'asc' }],
      select: { id: true, date: true, number: true, revision: true, status: true, taxable: true, cost: true, total: true, party: { select: { displayName: true } } },
    });
    return rows.map((row) => ({
      date: isoDate(row.date),
      number: quotationLabel(row.number, row.revision),
      customer: row.party.displayName,
      value: n(row.total),
      margin: marginPct(n(row.taxable), n(row.cost)),
      stage: quotationStage(row.status),
      href: `/quotations/${row.id}`,
    }));
  }

  private async purchaseRegister(period: Period): Promise<ReportRow[]> {
    const rows = await this.prisma.purchaseBill.findMany({
      where: { status: 'OPEN', date: period },
      orderBy: [{ date: 'asc' }, { reference: 'asc' }],
      select: { id: true, date: true, reference: true, vendorBillNumber: true, regime: true, taxable: true, tax: true, itcClaimable: true, payable: true, vendor: { select: { displayName: true } } },
    });
    return rows.map((row) => {
      const reverse = row.regime === 'REVERSE_CHARGE';
      return {
        date: isoDate(row.date),
        reference: row.reference,
        vendorBill: row.vendorBillNumber,
        vendor: row.vendor.displayName,
        taxable: n(row.taxable),
        tax: reverse ? 0 : n(row.tax),
        itc: n(row.itcClaimable),
        rcm: reverse ? n(row.tax) : 0,
        payable: n(row.payable),
        href: `/purchases/${row.id}`,
      };
    });
  }

  private async gstSummary(period: Period): Promise<ReportRow[]> {
    const heads = { cgst: true, sgst: true, igst: true } as const;
    const [sales, bills, expenses, creditNotes, debitNotes] = await Promise.all([
      this.prisma.invoice.findMany({ where: { status: 'ISSUED', date: period }, select: heads }),
      this.prisma.purchaseBill.findMany({ where: { status: 'OPEN', date: period }, select: { ...heads, tax: true, itcClaimable: true, regime: true } }),
      this.prisma.expense.findMany({ where: { cancelledAt: null, itcEligible: true, date: period }, select: heads }),
      // Notes count in the period they are dated (GSTR-1 table 9B, GSTR-3B 4B).
      // Notes without GST never touch the returns.
      this.prisma.creditNote.findMany({ where: { cancelledAt: null, gstAdjusted: true, date: period }, select: heads }),
      this.prisma.debitNote.findMany({ where: { cancelledAt: null, gstAdjusted: true, date: period }, select: { ...heads, tax: true, itcReversed: true } }),
    ]);
    const split = (row: { cgst: Prisma.Decimal; sgst: Prisma.Decimal; igst: Prisma.Decimal }) => ({ cgst: n(row.cgst), sgst: n(row.sgst), igst: n(row.igst) });
    const negative = (heads: { cgst: number; sgst: number; igst: number }, share = 1) => ({ cgst: -heads.cgst * share, sgst: -heads.sgst * share, igst: -heads.igst * share });
    return gstSummaryRows(
      // A credit note lowers output tax.
      [...sales.map(split), ...creditNotes.map((note) => negative(split(note)))],
      bills.map((bill) => ({ ...split(bill), tax: n(bill.tax), itcClaimable: n(bill.itcClaimable), reverseCharge: bill.regime === 'REVERSE_CHARGE' })),
      // A debit note gives back the credit it reversed, by head in proportion.
      [...expenses.map(split), ...debitNotes.map((note) => negative(split(note), n(note.tax) > 0 ? n(note.itcReversed) / n(note.tax) : 0))],
    );
  }

  private async hsnSummary(period: Period): Promise<ReportRow[]> {
    const [lines, noteLines, units] = await Promise.all([
      this.prisma.invoiceLine.findMany({
        where: { invoice: { status: 'ISSUED', date: period } },
        // In each item's reporting unit, as fixed when the invoice was saved.
        select: { hsn: true, reportUnit: true, gstRatePct: true, reportQuantity: true, taxable: true, tax: true },
      }),
      // Credit notes in the period net off, at their invoice line's HSN, unit and rate.
      this.prisma.creditNoteLine.findMany({
        where: { creditNote: { cancelledAt: null, gstAdjusted: true, date: period } },
        select: { quantity: true, taxable: true, tax: true, invoiceLine: { select: { hsn: true, reportUnit: true, gstRatePct: true, reportQuantity: true, quantity: true } } },
      }),
      this.prisma.unit.findMany({ select: { symbol: true, uqc: true } }),
    ]);
    const uqcOf = new Map(units.map((unit) => [unit.symbol, unit.uqc]));
    return hsnRows([
      ...lines.map((line) => ({
        hsn: line.hsn,
        uqc: uqcOf.get(line.reportUnit) ?? 'OTH',
        ratePct: n(line.gstRatePct),
        quantity: n(line.reportQuantity),
        taxable: n(line.taxable),
        tax: n(line.tax),
      })),
      ...noteLines.map((line) => ({
        hsn: line.invoiceLine.hsn,
        uqc: uqcOf.get(line.invoiceLine.reportUnit) ?? 'OTH',
        ratePct: n(line.invoiceLine.gstRatePct),
        // Returned base units in the reporting unit, by the line's own ratio.
        quantity: n(line.invoiceLine.quantity) > 0 ? -(n(line.quantity) * n(line.invoiceLine.reportQuantity)) / n(line.invoiceLine.quantity) : 0,
        taxable: -n(line.taxable),
        tax: -n(line.tax),
      })),
    ]);
  }

  private async salesByState(period: Period): Promise<ReportRow[]> {
    const rows = await this.prisma.invoice.findMany({
      where: { status: 'ISSUED', date: period },
      select: { placeOfSupply: true, taxable: true },
    });
    const places = new Map<string, { place: string; invoices: number; taxable: number }>();
    for (const row of rows) {
      const place = placeLabel(row);
      const entry = places.get(place) ?? { place, invoices: 0, taxable: 0 };
      entry.invoices += 1;
      entry.taxable = paise(entry.taxable + n(row.taxable));
      places.set(place, entry);
    }
    return [...places.values()].sort((a, b) => b.taxable - a.taxable);
  }

  private async stockSummary(): Promise<ReportRow[]> {
    const items = await this.prisma.item.findMany({
      where: { isArchived: false },
      orderBy: [{ name: 'asc' }, { sku: 'asc' }],
      select: {
        id: true,
        sku: true,
        name: true,
        reorderLevel: true,
        ...itemCostSource,
        unit: { select: { symbol: true } },
        group: { select: unitOf },
        category: { select: unitOf },
        subCategory: { select: unitOf },
      },
    });
    return items.map((item) => {
      const stock = stockOnHand(item);
      const cost = itemCosts(item).stockCost ?? 0;
      return {
        sku: item.sku ?? '',
        item: item.name,
        stock,
        unit: inherited(item.unit?.symbol, item.group?.defaultUnit?.symbol, item.subCategory?.defaultUnit?.symbol, item.category.defaultUnit?.symbol) ?? '',
        cost,
        value: stockValue(item),
        status: stockStatus(stock, n(item.reorderLevel)),
        // Opens the item's own summary: lots, rates, batch-wise profit.
        href: `/reports/item-summary?item=${item.id}`,
      };
    });
  }

  private async expensesByHead(period: Period): Promise<ReportRow[]> {
    const rows = await this.prisma.expense.findMany({
      where: { cancelledAt: null, date: period },
      select: { amount: true, tax: true, head: { select: { id: true, name: true, nature: true } } },
    });
    const heads = new Map<string, { head: string; group: string; count: number; amount: number; gst: number }>();
    for (const row of rows) {
      const entry = heads.get(row.head.id) ?? { head: row.head.name, group: HEAD_GROUPS[row.head.nature], count: 0, amount: 0, gst: 0 };
      entry.count += 1;
      entry.amount = paise(entry.amount + n(row.amount));
      entry.gst = paise(entry.gst + n(row.tax));
      heads.set(row.head.id, entry);
    }
    return [...heads.values()].sort((a, b) => b.amount - a.amount);
  }

  /** What each customer owes us and what we owe each vendor, from the open documents the Payments screen shows. */
  private async outstanding(): Promise<ReportRow[]> {
    const [receivable, payable] = await Promise.all([this.settlements.documents('RECEIPT'), this.settlements.documents('PAYMENT')]);
    const parties = new Map<string, { party: string; side: string; documents: number; balance: number; href: string }>();
    const add = (side: string, documents: typeof receivable) => {
      for (const document of documents.filter((open) => open.balance > 0)) {
        const key = `${side}|${document.partyId}`;
        const entry = parties.get(key) ?? { party: document.partyName, side, documents: 0, balance: 0, href: `/payments/ledger/${document.partyId}` };
        entry.documents += 1;
        entry.balance = paise(entry.balance + document.balance);
        parties.set(key, entry);
      }
    };
    add('Owes us', receivable);
    add('We owe', payable);
    return [...parties.values()].sort((a, b) => a.side.localeCompare(b.side) || b.balance - a.balance);
  }
}
