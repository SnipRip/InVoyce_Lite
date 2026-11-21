import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { toNumber } from '../common/decimal.js';
import { HEAD_GROUPS } from '../account-heads/account-head-rules.js';
import { BANK_CASH_GROUPS } from '../bank-cash-accounts/bank-cash-rules.js';
import type { StandardGroupName } from '../common/accounts/standard-groups.js';
import { PrismaService } from '../database/prisma.service.js';
import { groupMap } from '../ledgers/ledger-views.js';
import { loanGroup } from '../loans/loan-kinds.js';
import { round2 } from '../loans/loan-schedule.js';
import { LOAN_INCLUDE, toLoanDetailView } from '../loans/loan-view.js';
import { dateOnly, isoDate } from '../common/dates.js';
import {
  balanceSheet,
  groupTree,
  ledgerBalances,
  profitAndLoss,
  trialBalance,
  type BalanceSheet,
  type BookLedger,
  type LedgerSource,
  type Posting,
  type ProfitAndLoss,
  type TrialBalance,
} from './statements.js';
import { billPostings } from './bill-postings.js';
import { closingStock } from './closing-stock.js';
import { ledgerStatement, movementOn, type BookVoucher, type LedgerStatement, type VoucherSource } from './book-vouchers.js';
import { expensePostings, expenseVoucherType } from './expense-postings.js';
import { invoicePostings } from './invoice-postings.js';
import { settlementPostings } from './settlement-postings.js';
import { stockAdjustmentPostings } from './stock-adjustment-postings.js';
import { systemLedgers } from './system-ledgers.js';
import { journalVoucherType } from '../journals/journal-rules.js';
import { journalInclude, lineLedger } from '../journals/journal-views.js';
import { creditNotePostings, debitNotePostings } from './note-postings.js';

/** What every statement says about the data it was built from. */
export interface BooksBasis {
  asOf: string;
  /** Opening stock at cost from the items; closing stock from what moved since (closing-stock.ts). */
  stock: { opening: number; closing: number };
  /** Loan vouchers counted (first entries and entries up to the date). */
  voucherCount: number;
  /** Stock adjustments posted up to the date (not cancelled). */
  stockAdjustmentCount: number;
  /** Documents posted up to the date: issued invoices, open bills, live receipts, payments, expenses and journals. */
  documentCounts: { invoices: number; bills: number; receipts: number; payments: number; expenses: number; journals: number };
}

export interface TrialBalanceView extends TrialBalance, BooksBasis {}
export interface ProfitAndLossView extends ProfitAndLoss, BooksBasis {}
export interface BalanceSheetView extends BalanceSheet, BooksBasis {}

/** A bank or cash account's balance on a date: its opening plus everything posted through it. */
export interface BankCashBalanceView {
  accountId: string;
  asOf: string;
  /** Positive is money held; below zero is overdraft used. */
  balance: number;
}

/** A bank or cash account's ledger name. */
const bankCashLedger = (account: { name: string; ledgerName: string | null }) => account.ledgerName ?? account.name;

/** A party's ledger: its display name, under Sundry Debtors if it is a customer at all. */
const partyLedger = (party: { displayName: string; isCustomer: boolean }) => ({
  ledger: party.displayName,
  group: party.isCustomer ? 'Sundry Debtors' : 'Sundry Creditors',
});

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

// The books from the start to `asOf`, as the books show them by default: every
// ledger every master owns with its opening balance, and the vouchers the
// app records: loan entries, stock adjustments, issued invoices, open vendor
// bills, receipts, payments and expenses (the *-postings.ts files beside
// this one). Cancelled and void documents post nothing
// (agent/accounts-plan.md, "Statements").
@Injectable()
export class BooksService {
  constructor(private readonly prisma: PrismaService) {}

  private async load(asOf: string) {
    const db = this.prisma;
    const upTo = { lte: dateOnly(asOf) };
    const partyName = { select: { displayName: true, isCustomer: true } };
    const [groups, ledgers, heads, accounts, loans, parties, stock, adjustments, invoices, bills, settlements, expenses] = await Promise.all([
      db.ledgerGroup.findMany(),
      db.ledger.findMany(),
      db.accountHead.findMany(),
      db.bankCashAccount.findMany(),
      db.loan.findMany({ include: LOAN_INCLUDE }),
      db.party.findMany({ select: { id: true, displayName: true, isCustomer: true, openingBalance: true, openingBalanceSide: true } }),
      db.itemOpeningStock.aggregate({ _sum: { value: true } }),
      db.stockAdjustment.findMany({
        where: { status: 'POSTED', date: upTo },
        orderBy: [{ date: 'asc' }, { number: 'asc' }],
        select: { id: true, number: true, date: true, notes: true, direction: true, value: true },
      }),
      db.invoice.findMany({
        where: { status: 'ISSUED', date: upTo },
        orderBy: [{ date: 'asc' }, { number: 'asc' }],
        select: { id: true, number: true, date: true, regime: true, taxable: true, cgst: true, sgst: true, igst: true, roundOff: true, total: true, cost: true, party: partyName },
      }),
      db.purchaseBill.findMany({
        where: { status: 'OPEN', date: upTo },
        orderBy: [{ date: 'asc' }, { reference: 'asc' }],
        select: {
          id: true,
          reference: true,
          vendorBillNumber: true,
          date: true,
          kind: true,
          regime: true,
          cgst: true,
          sgst: true,
          igst: true,
          tax: true,
          itcClaimable: true,
          roundOff: true,
          payable: true,
          cost: true,
          landedCostForId: true,
          vendor: partyName,
          lines: { select: { taxable: true, ownCost: true, itcEligible: true } },
          charges: { select: { amount: true, tax: true, head: { select: { name: true, nature: true } } } },
        },
      }),
      db.settlement.findMany({
        where: { cancelledAt: null, date: upTo },
        orderBy: [{ date: 'asc' }, { number: 'asc' }],
        select: { id: true, number: true, date: true, notes: true, direction: true, amount: true, tds: true, party: partyName, account: { select: { name: true, ledgerName: true, kind: true } } },
      }),
      db.expense.findMany({
        where: { cancelledAt: null, date: upTo },
        orderBy: [{ date: 'asc' }, { number: 'asc' }],
        select: {
          id: true,
          number: true,
          date: true,
          notes: true,
          cgst: true,
          sgst: true,
          igst: true,
          itcEligible: true,
          total: true,
          cost: true,
          billId: true,
          head: { select: { name: true, nature: true } },
          vendor: partyName,
          account: { select: { name: true, ledgerName: true, kind: true } },
        },
      }),
    ]);
    const idOf = new Map(groups.map((group) => [group.name, group.id]));
    const under = (name: StandardGroupName) => idOf.get(name) ?? null;
    const role = systemLedgers(ledgers);

    const book: BookLedger[] = [
      ...ledgers.map((ledger) => ({
        name: ledger.name,
        groupId: ledger.groupId,
        source: 'ledger' as const,
        sourceId: ledger.id,
        opening: (ledger.openingSide === 'DR' ? 1 : -1) * toNumber(ledger.openingBalance),
      })),
      ...heads.map((head) => ({ name: head.name, groupId: under(HEAD_GROUPS[head.nature]), source: 'head' as const, sourceId: head.id, opening: 0 })),
      // A bank or cash balance is a debit; an overdraft opens below zero, a credit.
      ...accounts.map((account) => ({
        name: bankCashLedger(account),
        groupId: under(BANK_CASH_GROUPS[account.kind]),
        source: 'bankCash' as const,
        sourceId: account.id,
        opening: toNumber(account.openingBalance),
      })),
      ...parties.map((party) => ({
        name: party.displayName,
        groupId: under(party.isCustomer ? 'Sundry Debtors' : 'Sundry Creditors'),
        source: 'party' as const,
        sourceId: party.id,
        opening: (party.openingBalanceSide === 'RECEIVABLE' ? 1 : -1) * toNumber(party.openingBalance),
      })),
    ];

    const vouchers: BookVoucher[] = [];
    let voucherCount = 0;
    for (const loan of loans) {
      const view = toLoanDetailView(loan, asOf);
      const first = view.firstEntry;
      // A loan running before the books opens with what was owed; any other
      // first entry is a voucher on the day the money moved.
      const opening = first.type === 'Opening balance' ? first.lines.reduce((total, item) => total + item.debit - item.credit, 0) : 0;
      book.push({ name: loan.name, groupId: under(loanGroup(loan)), source: 'loan', sourceId: loan.id, opening });
      const entries = [
        ...(first.type === 'Opening balance' ? [] : [first]),
        ...view.entries.filter((entry) => !entry.cancelledAt).map((entry) => entry.voucher),
      ].filter((voucher) => voucher.date <= asOf);
      voucherCount += entries.length;
      for (const entry of entries) {
        vouchers.push({
          date: entry.date,
          type: entry.type,
          number: entry.number,
          source: 'loan',
          sourceId: loan.id,
          narration: loan.name,
          lines: entry.lines.map((item) => ({ ledger: item.ledger, group: item.group, debit: item.debit, credit: item.credit })),
        });
      }
    }

    const openingStock = toNumber(stock._sum.value ?? null) ?? 0;
    book.push({ name: 'Opening Stock', groupId: under('Stock-in-Hand'), source: 'stock', sourceId: null, opening: openingStock });

    // Stock adjustments post a journal each, to the system ledgers found by role.
    const stockNames = { writeOff: role('STOCK_WRITE_OFF').ledger, found: role('STOCK_FOUND').ledger, adjustment: role('STOCK_ADJUSTMENT').ledger };
    let stockChange = 0;
    for (const adjustment of adjustments) {
      const moved = stockAdjustmentPostings([{ direction: adjustment.direction, value: toNumber(adjustment.value) }], stockNames);
      stockChange += moved.closingChange;
      vouchers.push({
        date: isoDate(adjustment.date),
        type: 'Stock Journal',
        number: adjustment.number,
        source: 'stockAdjustment',
        sourceId: adjustment.id,
        narration: adjustment.notes,
        lines: moved.postings,
      });
    }

    for (const invoice of invoices) {
      const figures = {
        regime: invoice.regime,
        taxable: toNumber(invoice.taxable),
        cgst: toNumber(invoice.cgst),
        sgst: toNumber(invoice.sgst),
        igst: toNumber(invoice.igst),
        roundOff: toNumber(invoice.roundOff),
        total: toNumber(invoice.total),
      };
      vouchers.push({
        date: isoDate(invoice.date),
        type: 'Sales',
        number: invoice.number,
        source: 'invoice',
        sourceId: invoice.id,
        narration: null,
        lines: invoicePostings(figures, partyLedger(invoice.party), role),
      });
    }

    for (const bill of bills) {
      const figures = {
        regime: bill.regime,
        cgst: toNumber(bill.cgst),
        sgst: toNumber(bill.sgst),
        igst: toNumber(bill.igst),
        tax: toNumber(bill.tax),
        itcClaimable: toNumber(bill.itcClaimable),
        roundOff: toNumber(bill.roundOff),
        payable: toNumber(bill.payable),
        lines: bill.lines.map((line) => ({ taxable: toNumber(line.taxable), ownCost: toNumber(line.ownCost), itcEligible: line.itcEligible })),
        charges: bill.charges.map((charge) => ({ head: { ledger: charge.head.name, group: HEAD_GROUPS[charge.head.nature] }, amount: toNumber(charge.amount), tax: toNumber(charge.tax) })),
      };
      vouchers.push({
        date: isoDate(bill.date),
        type: 'Purchase',
        number: bill.reference,
        source: 'bill',
        sourceId: bill.id,
        narration: `Vendor bill ${bill.vendorBillNumber}`,
        lines: billPostings(figures, partyLedger(bill.vendor), role),
      });
    }

    for (const settlement of settlements) {
      const account = { ledger: bankCashLedger(settlement.account), group: BANK_CASH_GROUPS[settlement.account.kind] };
      const figures = { direction: settlement.direction, amount: toNumber(settlement.amount), tds: toNumber(settlement.tds) };
      vouchers.push({
        date: isoDate(settlement.date),
        type: settlement.direction === 'RECEIPT' ? 'Receipt' : 'Payment',
        number: settlement.number,
        source: 'settlement',
        sourceId: settlement.id,
        narration: settlement.notes,
        lines: settlementPostings(figures, partyLedger(settlement.party), account, role),
      });
    }

    for (const expense of expenses) {
      // Paid: a Payment voucher against the account; on credit: a Purchase voucher against the vendor.
      const creditTo = expense.account
        ? { ledger: bankCashLedger(expense.account), group: BANK_CASH_GROUPS[expense.account.kind] }
        : partyLedger(expense.vendor!);
      const figures = {
        cgst: toNumber(expense.cgst),
        sgst: toNumber(expense.sgst),
        igst: toNumber(expense.igst),
        itcEligible: expense.itcEligible,
        total: toNumber(expense.total),
        cost: toNumber(expense.cost),
      };
      vouchers.push({
        date: isoDate(expense.date),
        type: expenseVoucherType(Boolean(expense.account)),
        number: expense.number,
        source: 'expense',
        sourceId: expense.id,
        narration: expense.notes,
        lines: expensePostings(figures, { ledger: expense.head.name, group: HEAD_GROUPS[expense.head.nature] }, creditTo, role),
      });
    }

    // Credit notes: the invoice's voucher turned round; goods back re-enter closing stock.
    const creditNotes = await db.creditNote.findMany({
      where: { cancelledAt: null, date: upTo },
      orderBy: [{ date: 'asc' }, { number: 'asc' }],
      select: { id: true, number: true, date: true, notes: true, regime: true, gstAdjusted: true, taxable: true, cgst: true, sgst: true, igst: true, roundOff: true, total: true, cost: true, party: partyName, invoice: { select: { number: true } } },
    });
    for (const note of creditNotes) {
      const figures = {
        regime: note.regime,
        gstAdjusted: note.gstAdjusted,
        taxable: toNumber(note.taxable) ?? 0,
        cgst: toNumber(note.cgst) ?? 0,
        sgst: toNumber(note.sgst) ?? 0,
        igst: toNumber(note.igst) ?? 0,
        roundOff: toNumber(note.roundOff) ?? 0,
        total: toNumber(note.total) ?? 0,
      };
      vouchers.push({
        date: isoDate(note.date),
        type: 'Credit Note',
        number: note.number,
        source: 'creditNote',
        sourceId: note.id,
        narration: [`Against invoice ${note.invoice.number}`, note.notes].filter(Boolean).join(': '),
        lines: creditNotePostings(figures, partyLedger(note.party), role),
      });
    }

    // Debit notes: the bill's voucher turned round; goods sent back leave closing stock.
    const debitNotes = await db.debitNote.findMany({
      where: { cancelledAt: null, date: upTo },
      orderBy: [{ date: 'asc' }, { number: 'asc' }],
      select: {
        id: true,
        number: true,
        date: true,
        notes: true,
        gstAdjusted: true,
        cgst: true,
        sgst: true,
        igst: true,
        tax: true,
        itcReversed: true,
        roundOff: true,
        total: true,
        cost: true,
        party: partyName,
        bill: { select: { reference: true, regime: true } },
        lines: { select: { taxable: true, tax: true, itcEligible: true } },
      },
    });
    for (const note of debitNotes) {
      const figures = {
        regime: note.bill.regime,
        gstAdjusted: note.gstAdjusted,
        cgst: toNumber(note.cgst) ?? 0,
        sgst: toNumber(note.sgst) ?? 0,
        igst: toNumber(note.igst) ?? 0,
        tax: toNumber(note.tax) ?? 0,
        itcReversed: toNumber(note.itcReversed) ?? 0,
        roundOff: toNumber(note.roundOff) ?? 0,
        total: toNumber(note.total) ?? 0,
        lines: note.lines.map((line) => ({ taxable: toNumber(line.taxable) ?? 0, tax: toNumber(line.tax) ?? 0, itcEligible: line.itcEligible })),
      };
      vouchers.push({
        date: isoDate(note.date),
        type: 'Debit Note',
        number: note.number,
        source: 'debitNote',
        sourceId: note.id,
        narration: [`Against bill ${note.bill.reference}`, note.notes].filter(Boolean).join(': '),
        lines: debitNotePostings(figures, partyLedger(note.party), role),
      });
    }

    // Journals: each line already names its ledger and group (journal-views.ts).
    const journals = await db.journalVoucher.findMany({
      where: { cancelledAt: null, date: upTo },
      orderBy: [{ date: 'asc' }, { number: 'asc' }],
      include: { lines: journalInclude.lines },
    });
    for (const journal of journals) {
      const lines = journal.lines.map((line) => ({ ...lineLedger(line), debit: toNumber(line.debit) ?? 0, credit: toNumber(line.credit) ?? 0 }));
      vouchers.push({
        date: isoDate(journal.date),
        type: journalVoucherType(lines),
        number: journal.number,
        source: 'journal',
        sourceId: journal.id,
        narration: journal.narration,
        lines: lines.map((line) => ({ ledger: line.ledger, group: line.group, debit: line.debit, credit: line.credit })),
      });
    }

    const closing = closingStock({
      opening: openingStock,
      // A goods bill brings its stock in; a freight or labour bill added to it lands on the same stock.
      // Expenses allocated to a purchase's items land on its stock the same way.
      purchased:
        sum(bills.filter((bill) => bill.kind === 'GOODS' || bill.landedCostForId).map((bill) => toNumber(bill.cost))) +
        sum(expenses.filter((expense) => expense.billId).map((expense) => toNumber(expense.cost))),
      adjusted: stockChange,
      // Goods customers returned come back in at cost; goods sent back to vendors leave at landed cost.
      sold: sum(invoices.map((invoice) => toNumber(invoice.cost))) - sum(creditNotes.map((note) => toNumber(note.cost))) + sum(debitNotes.map((note) => toNumber(note.cost))),
    });

    const meta = groupMap(groups);
    const postings: Posting[] = vouchers.flatMap((entry) => entry.lines);
    const balances = ledgerBalances(book, postings, meta);
    const trial = trialBalance(groupTree(groups, balances), balances);
    const basis: BooksBasis = {
      asOf,
      stock: { opening: openingStock, closing },
      voucherCount,
      stockAdjustmentCount: adjustments.length,
      documentCounts: {
        invoices: invoices.length,
        bills: bills.length,
        receipts: settlements.filter((settlement) => settlement.direction === 'RECEIPT').length,
        payments: settlements.filter((settlement) => settlement.direction === 'PAYMENT').length,
        expenses: expenses.length,
        journals: journals.length,
      },
    };
    return { meta, trial, balances, basis, book, vouchers };
  }

  async trialBalance(asOf: string): Promise<TrialBalanceView> {
    const { trial, basis } = await this.load(asOf);
    return { ...trial, ...basis };
  }

  async profitAndLoss(asOf: string): Promise<ProfitAndLossView> {
    const { trial, meta, basis } = await this.load(asOf);
    return { ...profitAndLoss(trial.groups, meta, basis.stock), ...basis };
  }

  async balanceSheet(asOf: string): Promise<BalanceSheetView> {
    const { trial, meta, basis } = await this.load(asOf);
    const pl = profitAndLoss(trial.groups, meta, basis.stock);
    return { ...balanceSheet(trial, meta, pl.netProfit, basis.stock), ...basis };
  }

  /** Every bank, overdraft and cash account's balance on the date, with loan entries, receipts, payments and expenses through it. */
  async bankCashBalances(asOf: string): Promise<BankCashBalanceView[]> {
    const { balances } = await this.load(asOf);
    return balances.filter((ledger) => ledger.source === 'bankCash' && ledger.sourceId).map((ledger) => ({ accountId: ledger.sourceId!, asOf, balance: ledger.closing }));
  }

  /** Every ledger in the books on the date, with its group and closing balance, for the statement picker. */
  async ledgers(asOf: string): Promise<BookLedgerView[]> {
    const { balances, meta } = await this.load(asOf);
    return balances
      .map((ledger) => ({
        name: ledger.name,
        group: ledger.groupId ? (meta.get(ledger.groupId)?.name ?? null) : null,
        source: ledger.source,
        sourceId: ledger.sourceId,
        closing: ledger.closing,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** One ledger's vouchers between two dates with a running balance (the cash and bank books are these). */
  async ledgerStatement(name: string, from: string, to: string): Promise<LedgerStatement> {
    if (from > to) throw new BadRequestException('The first day is after the last day');
    const { balances, meta, vouchers } = await this.load(to);
    const ledger = balances.find((candidate) => candidate.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (!ledger) throw new NotFoundException(`No ledger is named "${name}"`);
    const group = ledger.groupId ? (meta.get(ledger.groupId)?.name ?? null) : null;
    return ledgerStatement({ name: ledger.name, group, opening: ledger.opening }, vouchers, from, to);
  }

  /**
   * Indirect incomes and expenses booked between two dates by anything but
   * the expense register (the profit report counts expenses itself): loan
   * interest and bank charges, stock written off or found, overhead charges
   * bills, journals and notes. Ledgers count under any sub-group too.
   */
  async indirectMovements(from: string, to: string): Promise<{ income: number; expenses: number }> {
    const { balances, meta, vouchers } = await this.load(to);
    const under = (groupId: string | null, root: string) => {
      for (let id = groupId, hops = 0; id && hops < 20; hops++) {
        const node = meta.get(id);
        if (!node) return false;
        if (node.name === root) return true;
        id = node.parentId;
      }
      return false;
    };
    const groupOf = new Map(balances.map((ledger) => [ledger.name.trim().toLowerCase(), ledger.groupId]));
    const inGroup = (root: string) => (name: string) => under(groupOf.get(name.trim().toLowerCase()) ?? null, root);
    const skip = new Set<VoucherSource>(['expense']);
    // Direct expenses and incomes reach the profit report through invoices,
    // bills (landed cost) and the expense register; a journal is the one way
    // they can be booked outside those, so its direct lines count here too.
    const onlyJournals = new Set<VoucherSource>(['loan', 'stockAdjustment', 'invoice', 'bill', 'settlement', 'expense', 'creditNote', 'debitNote']);
    return {
      // Incomes are credits: their movement is negative, so it is turned round.
      income: round2(-movementOn(vouchers, inGroup('Indirect Incomes'), from, to, skip) - movementOn(vouchers, inGroup('Direct Incomes'), from, to, onlyJournals)),
      expenses: round2(movementOn(vouchers, inGroup('Indirect Expenses'), from, to, skip) + movementOn(vouchers, inGroup('Direct Expenses'), from, to, onlyJournals)),
    };
  }
}

/** A ledger as the statement picker lists it. */
export interface BookLedgerView {
  name: string;
  group: string | null;
  source: LedgerSource;
  sourceId: string | null;
  /** Debit positive. */
  closing: number;
}
