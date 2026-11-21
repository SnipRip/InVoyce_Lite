import { BadRequestException, Injectable } from '@nestjs/common';
import { dateOnly, isoDate, todayInIndia } from '../common/dates.js';
import { toNumber } from '../common/decimal.js';
import { financialYearOf } from '../common/financial-year.js';
import { BooksService } from '../books/books.service.js';
import { PrismaService } from '../database/prisma.service.js';
import type { ProfitQueryDto } from './dto/profit-query.dto.js';
import { buildProfitReport, type ProfitExpense, type ProfitInvoice, type ProfitReport } from './profit-rules.js';

export interface ProfitReportView extends ProfitReport {
  from: string;
  to: string;
  /** Indirect incomes in the period from the books: interest received, stock found, other incomes by journal. */
  otherIncome: number;
  /** Expenses in the period from the books that the expense register does not hold: loan interest, bank charges, stock written off, overhead charges bills, and journals (indirect or direct). */
  otherExpenses: number;
}

// Read-only: the period's issued invoices with their lines, and the live
// expenses that touch them plus the period's overheads.
@Injectable()
export class ProfitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly books: BooksService,
  ) {}

  async report(query: ProfitQueryDto): Promise<ProfitReportView> {
    const to = query.to ?? todayInIndia();
    const from = query.from ?? `${financialYearOf(to).slice(0, 4)}-04-01`;
    if (from > to) throw new BadRequestException('The first day is after the last day');
    const period = { gte: dateOnly(from), lte: dateOnly(to) };

    const invoiceRows = await this.prisma.invoice.findMany({
      where: { status: 'ISSUED', date: period },
      orderBy: [{ date: 'asc' }, { number: 'asc' }],
      select: {
        id: true,
        number: true,
        date: true,
        partyId: true,
        party: { select: { displayName: true } },
        taxable: true,
        cost: true,
        lines: {
          orderBy: { position: 'asc' },
          select: { id: true, itemId: true, taxable: true, costOfGoods: true, item: { select: { name: true, sku: true } } },
        },
      },
    });
    const invoiceIds = invoiceRows.map((row) => row.id);

    const expenseRows = await this.prisma.expense.findMany({
      where: {
        cancelledAt: null,
        OR: [
          { allocation: 'INVOICE', invoiceId: { in: invoiceIds } },
          { allocation: 'OVERHEAD', date: period },
        ],
      },
      select: { id: true, date: true, cost: true, allocation: true, invoiceId: true, head: { select: { name: true } } },
    });

    // Credit notes up to the last day take their value and returned cost off
    // the invoice line they are against (sales returns, rate differences).
    const noteLines = await this.prisma.creditNoteLine.findMany({
      // Notes without GST are a discount in the books (Discount Allowed, counted in other expenses), not a lower sale.
      where: { creditNote: { cancelledAt: null, gstAdjusted: true, invoiceId: { in: invoiceIds }, date: { lte: dateOnly(to) } } },
      select: { invoiceLineId: true, taxable: true, cost: true },
    });
    const takenOff = new Map<string, { taxable: number; cost: number }>();
    for (const line of noteLines) {
      const sofar = takenOff.get(line.invoiceLineId) ?? { taxable: 0, cost: 0 };
      takenOff.set(line.invoiceLineId, { taxable: sofar.taxable + (toNumber(line.taxable) ?? 0), cost: sofar.cost + (toNumber(line.cost) ?? 0) });
    }
    const net = (value: number) => Math.round(value * 100) / 100;
    const lineTaken = (id: string) => takenOff.get(id) ?? { taxable: 0, cost: 0 };
    const invoiceTaken = (lines: { id: string }[]) =>
      lines.reduce((sum, line) => ({ taxable: sum.taxable + lineTaken(line.id).taxable, cost: sum.cost + lineTaken(line.id).cost }), { taxable: 0, cost: 0 });

    const invoices: ProfitInvoice[] = invoiceRows.map((row) => ({
      id: row.id,
      number: row.number,
      date: isoDate(row.date),
      partyId: row.partyId,
      partyName: row.party.displayName,
      taxable: net(toNumber(row.taxable) - invoiceTaken(row.lines).taxable),
      cost: net(toNumber(row.cost) - invoiceTaken(row.lines).cost),
      lines: row.lines.map((line) => ({
        itemId: line.itemId,
        itemName: line.item.name,
        sku: line.item.sku,
        taxable: net(toNumber(line.taxable) - lineTaken(line.id).taxable),
        costOfGoods: net(toNumber(line.costOfGoods) - lineTaken(line.id).cost),
      })),
    }));
    // A credit note dated in the period against an invoice from before it is a
    // sales return of this period: a negative sale of its own, so the return
    // is never lost between periods (accrual, as the books take it).
    const earlierReturns = await this.prisma.creditNote.findMany({
      where: { cancelledAt: null, gstAdjusted: true, date: period, invoice: { date: { lt: dateOnly(from) } } },
      orderBy: [{ date: 'asc' }, { number: 'asc' }],
      select: {
        id: true,
        number: true,
        date: true,
        partyId: true,
        party: { select: { displayName: true } },
        invoice: { select: { number: true } },
        lines: { orderBy: { position: 'asc' }, select: { itemId: true, taxable: true, cost: true, item: { select: { name: true, sku: true } } } },
      },
    });
    for (const note of earlierReturns) {
      const lines = note.lines.map((line) => ({
        itemId: line.itemId,
        itemName: line.item.name,
        sku: line.item.sku,
        taxable: -(toNumber(line.taxable) ?? 0),
        costOfGoods: -(toNumber(line.cost) ?? 0),
      }));
      invoices.push({
        id: note.id,
        number: note.number,
        date: isoDate(note.date),
        partyId: note.partyId,
        partyName: note.party.displayName,
        taxable: net(lines.reduce((sum, line) => sum + line.taxable, 0)),
        cost: net(lines.reduce((sum, line) => sum + line.costOfGoods, 0)),
        lines,
        creditNoteOf: note.invoice.number,
      });
    }

    const expenses: ProfitExpense[] = expenseRows.map((row) => ({
      id: row.id,
      date: isoDate(row.date),
      headName: row.head.name,
      cost: toNumber(row.cost),
      allocation: row.allocation,
      invoiceId: row.invoiceId,
    }));

    const overheads = expenses.filter((expense) => expense.allocation === 'OVERHEAD');
    const onSales = expenses.filter((expense) => expense.allocation !== 'OVERHEAD');
    const report = buildProfitReport(invoices, onSales, overheads);
    // Net profit as the books see it: indirect incomes in, every indirect expense out (client, 12 Nov 2026).
    const other = await this.books.indirectMovements(from, to);
    return {
      from,
      to,
      ...report,
      otherIncome: other.income,
      otherExpenses: other.expenses,
      netProfit: Math.round((report.netProfit + other.income - other.expenses) * 100) / 100,
    };
  }
}
