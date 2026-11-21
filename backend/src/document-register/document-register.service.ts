import { Injectable } from '@nestjs/common';
import { isoDate } from '../common/dates.js';
import { toNumber } from '../common/decimal.js';
import { PrismaService } from '../database/prisma.service.js';
import { requiredPapers } from './document-register-rules.js';
import type { DocumentRegisterView, MissingPaperView, RegisterEntryView } from './document-register-views.js';

const byDateDesc = (a: { date: string }, b: { date: string }) => b.date.localeCompare(a.date);

// Read-only: the register is built from the records the papers belong to
// (invoice dispatch documents, vendor bills), so there is no second
// copy to keep in step. Papers are attached or corrected on the invoice page.
@Injectable()
export class DocumentRegisterService {
  constructor(private readonly prisma: PrismaService) {}

  async register(): Promise<DocumentRegisterView> {
    const [documents, bills, open] = await Promise.all([
      this.prisma.invoiceDocument.findMany({
        select: {
          kind: true,
          number: true,
          date: true,
          details: true,
          invoice: {
            select: { id: true, number: true, status: true, vehicleNumber: true, party: { select: { displayName: true } } },
          },
        },
      }),
      this.prisma.purchaseBill.findMany({
        select: {
          id: true,
          reference: true,
          vendorBillNumber: true,
          date: true,
          ewayBillNumber: true,
          ewayBillDate: true,
          vehicleNumber: true,
          status: true,
          vendor: { select: { displayName: true } },
        },
      }),
      // Issued invoices: the papers they still need.
      this.prisma.invoice.findMany({
        where: { status: 'ISSUED' },
        orderBy: [{ date: 'asc' }, { number: 'asc' }],
        select: {
          id: true,
          number: true,
          date: true,
          total: true,
          party: { select: { displayName: true, treatment: true } },
          documents: { select: { kind: true } },
        },
      }),
    ]);

    const fromInvoices = documents.map(({ invoice, ...doc }): RegisterEntryView => {
      const details = doc.details as Record<string, unknown>;
      return {
        kind: doc.kind,
        number: doc.number,
        date: isoDate(doc.date),
        owner: { type: 'INVOICE', id: invoice.id, number: invoice.number },
        partyName: invoice.party.displayName,
        vehicle: (typeof details.vehicle === 'string' ? details.vehicle : null) ?? invoice.vehicleNumber ?? null,
        cancelled: invoice.status === 'CANCELLED',
      };
    });

    const fromBills = bills.flatMap((bill): RegisterEntryView[] => {
      const base = {
        owner: { type: 'BILL' as const, id: bill.id, number: bill.reference },
        partyName: bill.vendor.displayName,
        cancelled: bill.status === 'VOID',
      };
      const entries: RegisterEntryView[] = [{ ...base, kind: 'VENDOR_BILL', number: bill.vendorBillNumber, date: isoDate(bill.date), vehicle: null }];
      if (bill.ewayBillNumber) {
        entries.push({
          ...base,
          kind: 'PURCHASE_EWAY_BILL',
          number: bill.ewayBillNumber,
          date: isoDate(bill.ewayBillDate ?? bill.date),
          vehicle: bill.vehicleNumber,
        });
      }
      return entries;
    });

    const missing = open.flatMap((invoice): MissingPaperView[] => {
      const attached = new Set(invoice.documents.map((doc) => doc.kind));
      return requiredPapers({ treatment: invoice.party.treatment, total: toNumber(invoice.total) })
        .filter((kind) => !attached.has(kind))
        .map((kind) => ({
          kind,
          invoice: { id: invoice.id, number: invoice.number, date: isoDate(invoice.date) },
          partyName: invoice.party.displayName,
        }));
    });

    return { entries: [...fromInvoices, ...fromBills].sort(byDateDesc), missing };
  }
}
