import { billedAs, partyBranch } from '../parties/party-branch.js';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { dateOnly } from '../common/dates.js';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { inReportingUnit } from '../items/line-units.js';
import { NumberSeriesService } from '../number-series/number-series.service.js';
import { liveGodown, ourRegistration } from '../purchases/purchase-context.js';
import { SalePricingService } from '../sale-pricing/sale-pricing.service.js';
import { invoiceRegime } from '../sale-pricing/sale-rules.js';
import { liveSettlementNumbers } from '../settlements/settlements.service.js';
import { costOfDraws } from '../stock/fifo-rules.js';
import { drawStock, returnStock } from '../stock/stock-out.js';
import { pickedVehicleNumber } from '../vehicles/picked-vehicle.js';
import type { InvoiceDto } from './dto/invoice.dto.js';
import { conversionProblem, quantityOut } from './invoice-rules.js';
import { invoiceInclude, toInvoiceView, type InvoiceView } from './invoice-views.js';
import { freeToSend, invoiceFromChallanProblem } from '../challans/challan-rules.js';
import { challanStock } from '../challans/challan-stock.js';
import { lockRows } from '../database/sql.js';

type Tx = Prisma.TransactionClient;

const money = (value: number) => Math.round(value * 100) / 100;
const fail = (message: string | null) => {
  if (message) throw new BadRequestException(message);
};

// Sales invoices: a GST tax invoice (or a bill of supply). On save, in one
// transaction: every line is priced on the server exactly as a quotation is
// (SalePricingService), GST follows the invoice's place of supply, the
// number comes from the sales invoice series, and the goods are drawn out of the
// godown's stock oldest first (src/stock), so each line keeps the real cost
// of what it sent. Invoices are not edited: cancel (stock goes back, number
// cancelled) and issue a new one.
@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbers: NumberSeriesService,
    private readonly pricing: SalePricingService,
  ) {}

  async list(partyId?: string): Promise<InvoiceView[]> {
    const rows = await this.prisma.invoice.findMany({
      where: { partyId },
      include: invoiceInclude,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map(toInvoiceView);
  }

  async get(id: string): Promise<InvoiceView> {
    return toInvoiceView(await this.prisma.invoice.findUniqueOrThrow({ where: { id }, include: invoiceInclude }));
  }

  create(dto: InvoiceDto, userId: string): Promise<InvoiceView> {
    return this.prisma.$transaction(
      async (tx) => {
        const party = await tx.party.findUnique({
          where: { id: dto.partyId },
          select: { isCustomer: true, isArchived: true, treatment: true, placeOfSupply: true },
        });
        if (!party?.isCustomer) fail('Pick a customer');
        if (party!.isArchived) fail('This customer is archived');
        // Bill to: its GSTIN and state decide the tax (IGST Act s.10(1)(b)). Ship to: where the goods go.
        const billTo = await partyBranch(tx, dto.partyId, dto.billToBranchId, 'billing');
        const shipTo = await partyBranch(tx, dto.partyId, dto.shipToBranchId, 'delivery');
        const billed = billedAs(party!, billTo);
        await liveGodown(tx, dto.godownId);
        if (dto.quotationId) await this.claimQuotation(tx, dto.quotationId, dto.partyId);
        // Raised from a delivery challan: open, same customer and godown; marked invoiced below.
        if (dto.challanId) {
          await lockRows(tx, 'DeliveryChallan', dto.challanId);
          const challan = (await tx.deliveryChallan.findUnique({ where: { id: dto.challanId }, select: { status: true, partyId: true, godownId: true, number: true } }))!;
          if (!challan) fail('That delivery challan does not exist');
          fail(invoiceFromChallanProblem(challan, { partyId: dto.partyId, godownId: dto.godownId }));
        }

        const company = await ourRegistration(tx);
        const sale = invoiceRegime(company, billed, { placeOfSupply: billTo ? billTo.placeOfSupply : dto.placeOfSupply });
        fail(sale.problem);
        const gstApplicable = dto.gstApplicable !== false;
        // An invoice without GST is a bill of supply.
        const regime = gstApplicable ? sale.regime : 'BILL_OF_SUPPLY';
        const { split, placeOfSupply } = sale;
        const { lines, totals } = await this.pricing.price(tx, {
          partyId: dto.partyId,
          date: dto.date,
          split,
          gstApplicable,
          enforceHsnGstRate: company.enforceHsnGstRate === true,
          lines: dto.lines,
        });

        // Stock out, oldest first. Lines are drawn in item order so two
        // invoices lock the same rows in the same order and never deadlock.
        const godown = await tx.godown.findUniqueOrThrow({ where: { id: dto.godownId }, select: { name: true } });
        // Goods out on open delivery challans have left the godown: only the
        // invoice raised from their challan may bill them.
        const wanted = new Map<string, number>();
        for (const { row } of lines) wanted.set(row.itemId, (wanted.get(row.itemId) ?? 0) + quantityOut(row));
        const held = await challanStock(tx, dto.godownId, [...wanted.keys()], dto.challanId ?? undefined);
        for (const [itemId, quantity] of wanted) {
          const stock = held.get(itemId);
          if (stock && stock.onChallans > 0 && quantity > freeToSend(stock)) {
            fail(`${stock.name}: ${stock.onChallans} of the ${stock.onHand} in ${godown.name} is out on open delivery challans, so only ${freeToSend(stock)} is free to bill. Bill those goods from their challan.`);
          }
        }
        const order = [...lines.keys()].sort((a, b) => lines[a].row.itemId.localeCompare(lines[b].row.itemId) || a - b);
        const drawsOf = new Map<number, Awaited<ReturnType<typeof drawStock>>>();
        for (const index of order) {
          const { row, item } = lines[index];
          const draws = await drawStock(tx, {
            itemId: row.itemId,
            godownId: dto.godownId,
            date: dto.date,
            quantity: quantityOut(row),
            label: { item: item.name, unit: item.unit, godown: godown.name, free: row.freeQuantity },
          });
          drawsOf.set(index, draws);
        }

        const claimed = await this.numbers.issue(tx, 'SALES_INVOICE', dto.date, { typed: dto.number ?? undefined });
        let cost = 0;
        const lineRows = lines.map(({ row, item }, index) => {
          const draws = drawsOf.get(index)!;
          const costOfGoods = costOfDraws(draws);
          cost = money(cost + costOfGoods);
          return { ...row, ...inReportingUnit(item, row.quantity), costOfGoods, draws: { create: draws.map((draw) => ({ batchId: draw.batchId, quantity: draw.quantity, rate: draw.rate })) } };
        });
        const row = await tx.invoice.create({
          data: {
            number: claimed.number,
            issuedNumberId: claimed.id,
            date: dateOnly(dto.date),
            partyId: dto.partyId,
            godownId: dto.godownId,
            regime,
            gstApplicable,
            placeOfSupply,
            billToBranchId: billTo?.id ?? null,
            shipToBranchId: shipTo?.id ?? null,
            shipToLine: dto.shipToLine ?? shipTo?.addressLine ?? null,
            shipToCity: dto.shipToCity ?? shipTo?.city ?? null,
            vehicleNumber: await pickedVehicleNumber(tx, dto.vehicleId, dto.vehicleNumber ?? null),
            vehicleId: dto.vehicleId ?? null,
            notes: dto.notes ?? null,
            quotationId: dto.quotationId ?? null,
            ...totals,
            cost,
            createdById: userId,
            lines: { create: lineRows },
          },
          include: invoiceInclude,
        });
        await tx.issuedNumber.update({ where: { id: claimed.id }, data: { documentId: row.id } });
        if (dto.challanId) await tx.deliveryChallan.update({ where: { id: dto.challanId }, data: { status: 'INVOICED', invoiceId: row.id } });
        return toInvoiceView(row);
      },
      // Fifty lines each locking their batches take longer than Prisma's 5 s default.
      { timeout: 20_000 },
    );
  }

  /** Cancels an issued invoice with no live receipts, or expenses on it: its stock goes back, its number is cancelled, its quotation is open again. */
  cancel(id: string, reason: string): Promise<InvoiceView> {
    return this.prisma.$transaction(async (tx) => {
      await lockRows(tx, 'Invoice', id);
      const current = (await tx.invoice.findUnique({ where: { id }, select: { status: true, issuedNumberId: true, quotationId: true } }))!;
      if (!current) fail('That invoice does not exist');
      if (current.status === 'CANCELLED') throw new ConflictException('This invoice is already cancelled');
      const receipts = await liveSettlementNumbers(tx, { invoiceId: id });
      if (receipts.length) throw new ConflictException(`Receipts or note credits are applied to this invoice (${receipts.join(', ')}). Cancel them first.`);
      const notes = await tx.creditNote.findMany({ where: { invoiceId: id, cancelledAt: null }, select: { number: true } });
      if (notes.length) throw new ConflictException(`Credit notes are issued against this invoice (${notes.map((row) => row.number).join(', ')}). Cancel them first.`);
      const expenses = await tx.expense.findMany({ where: { invoiceId: id, cancelledAt: null }, select: { number: true } });
      if (expenses.length) throw new ConflictException(`Expenses are allocated to this invoice (${expenses.map((row) => row.number).join(', ')}). Cancel them first.`);
      await returnStock(tx, id);
      await this.numbers.cancel(tx, current.issuedNumberId);
      if (current.quotationId) {
        await tx.quotation.updateMany({ where: { id: current.quotationId, status: 'CONVERTED' }, data: { status: 'ACCEPTED' } });
      }
      // A challan billed by this invoice is open again: its goods are still out with the customer.
      await tx.deliveryChallan.updateMany({ where: { invoiceId: id }, data: { status: 'OPEN', invoiceId: null } });
      const row = await tx.invoice.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason },
        include: invoiceInclude,
      });
      return toInvoiceView(row);
    });
  }

  /** Locks the quotation and marks it converted; only the same customer's sent or accepted quotation. */
  private async claimQuotation(tx: Tx, quotationId: string, partyId: string) {
    await lockRows(tx, 'Quotation', quotationId);
    const quotation = (await tx.quotation.findUnique({ where: { id: quotationId }, select: { status: true, partyId: true, number: true } }))!;
    if (!quotation) fail('That quotation does not exist');
    if (quotation.partyId !== partyId) fail(`Quotation ${quotation.number} is for another customer`);
    const problem = conversionProblem(quotation.status);
    if (problem) throw new ConflictException(problem);
    await tx.quotation.update({ where: { id: quotationId }, data: { status: 'CONVERTED' } });
  }
}
