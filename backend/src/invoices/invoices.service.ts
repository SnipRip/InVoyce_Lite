import { billedAs, partyBranch } from '../parties/party-branch.js';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { dateOnly } from '../common/dates.js';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma, QuotationStatus } from '../generated/prisma/client.js';
import { inReportingUnit } from '../items/line-units.js';
import { NumberSeriesService } from '../number-series/number-series.service.js';
import { liveGodown, ourRegistration } from '../purchases/purchase-context.js';
import { SalePricingService } from '../sale-pricing/sale-pricing.service.js';
import { invoiceRegime } from '../sale-pricing/sale-rules.js';
import { liveSettlementNumbers } from '../settlements/settlements.service.js';
import { costOfDraws } from '../stock/fifo-rules.js';
import { shipmentCarrying } from '../shipments/shipment-locks.js';
import { drawStock, returnStock } from '../stock/stock-out.js';
import { pickedVehicleNumber } from '../vehicles/picked-vehicle.js';
import type { InvoiceDto } from './dto/invoice.dto.js';
import { conversionProblem, kindProblem, quantityOut, SERIES_OF } from './invoice-rules.js';
import { invoiceInclude, toInvoiceView, type InvoiceView } from './invoice-views.js';
import { freeToSend, invoiceFromChallanProblem } from '../challans/challan-rules.js';
import { challanStock } from '../challans/challan-stock.js';

type Tx = Prisma.TransactionClient;

const money = (value: number) => Math.round(value * 100) / 100;
const fail = (message: string | null) => {
  if (message) throw new BadRequestException(message);
};

// Sales invoices: a local GST tax invoice or an export invoice. On save, in
// one transaction: every line is priced on the server exactly as a quotation
// is (SalePricingService), GST follows the invoice's place of supply or
// export route, an export under LUT copies the LUT ARN in force on its date,
// the number comes from the kind's series, and the goods are drawn out of the
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
          select: { isCustomer: true, isArchived: true, treatment: true, placeOfSupply: true, exportRoute: true, country: true, currency: true },
        });
        if (!party?.isCustomer) fail('Pick a customer');
        if (party!.isArchived) fail('This customer is archived');
        // Bill to: its GSTIN and state decide the tax (IGST Act s.10(1)(b)). Ship to: where the goods go.
        const billTo = await partyBranch(tx, dto.partyId, dto.billToBranchId, 'billing');
        const shipTo = await partyBranch(tx, dto.partyId, dto.shipToBranchId, 'delivery');
        const billed = billedAs(party!, billTo);
        fail(kindProblem(dto.kind, billed.treatment));
        await liveGodown(tx, dto.godownId);
        if (dto.quotationId) await this.claimQuotation(tx, dto.quotationId, dto.partyId);
        // Raised from a delivery challan: open, same customer and godown; marked invoiced below.
        if (dto.challanId) {
          const [challan] = await tx.$queryRaw<{ status: string; partyId: string; godownId: string; number: string }[]>`
            SELECT "status", "partyId", "godownId", "number" FROM "DeliveryChallan" WHERE "id" = ${dto.challanId}::uuid FOR UPDATE`;
          if (!challan) fail('That delivery challan does not exist');
          fail(invoiceFromChallanProblem(challan, { partyId: dto.partyId, godownId: dto.godownId }));
        }

        const company = await ourRegistration(tx);
        const sale = invoiceRegime(company, dto.kind, billed, { placeOfSupply: billTo ? billTo.placeOfSupply : dto.placeOfSupply, exportRoute: dto.exportRoute });
        fail(sale.problem);
        const gstApplicable = dto.gstApplicable !== false;
        if (!gstApplicable && dto.kind === 'EXPORT') fail('An export without GST goes under LUT: pick the LUT route');
        // A local invoice without GST is a bill of supply.
        const regime = gstApplicable ? sale.regime : 'BILL_OF_SUPPLY';
        const { split, placeOfSupply } = sale;
        const lutArn = regime === 'EXPORT_LUT' ? await this.lutOn(tx, dto.date) : null;
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

        const claimed = await this.numbers.issue(tx, SERIES_OF[dto.kind], dto.date, { typed: dto.number ?? undefined });
        let cost = 0;
        const lineRows = lines.map(({ row, item }, index) => {
          const draws = drawsOf.get(index)!;
          const costOfGoods = costOfDraws(draws);
          cost = money(cost + costOfGoods);
          return { ...row, ...inReportingUnit(item, row.quantity), costOfGoods, draws: { create: draws.map((draw) => ({ batchId: draw.batchId, quantity: draw.quantity, rate: draw.rate })) } };
        });
        const row = await tx.invoice.create({
          data: {
            kind: dto.kind,
            number: claimed.number,
            issuedNumberId: claimed.id,
            date: dateOnly(dto.date),
            partyId: dto.partyId,
            godownId: dto.godownId,
            regime,
            gstApplicable,
            placeOfSupply,
            lutArn,
            destinationCountry: dto.kind === 'EXPORT' ? (party!.country ?? null) : null,
            currency: dto.currency ?? party!.currency,
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

  /** Cancels an issued invoice with no live receipts, expenses or shipment on it: its stock goes back, its number is cancelled, its quotation is open again. */
  cancel(id: string, reason: string): Promise<InvoiceView> {
    return this.prisma.$transaction(async (tx) => {
      const [current] = await tx.$queryRaw<{ status: string; issuedNumberId: string; quotationId: string | null }[]>`
        SELECT "status", "issuedNumberId", "quotationId" FROM "Invoice" WHERE "id" = ${id}::uuid FOR UPDATE`;
      if (!current) fail('That invoice does not exist');
      if (current.status === 'CANCELLED') throw new ConflictException('This invoice is already cancelled');
      const receipts = await liveSettlementNumbers(tx, { invoiceId: id });
      if (receipts.length) throw new ConflictException(`Receipts or note credits are applied to this invoice (${receipts.join(', ')}). Cancel them first.`);
      const notes = await tx.creditNote.findMany({ where: { invoiceId: id, cancelledAt: null }, select: { number: true } });
      if (notes.length) throw new ConflictException(`Credit notes are issued against this invoice (${notes.map((row) => row.number).join(', ')}). Cancel them first.`);
      const expenses = await tx.expense.findMany({ where: { invoiceId: id, cancelledAt: null }, select: { number: true } });
      if (expenses.length) throw new ConflictException(`Expenses are allocated to this invoice (${expenses.map((row) => row.number).join(', ')}). Cancel them first.`);
      const shipment = await shipmentCarrying(tx, id);
      if (shipment) throw new ConflictException(`This invoice is on shipment ${shipment}. Take it off the shipment or cancel the shipment first.`);
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
    const [quotation] = await tx.$queryRaw<{ status: QuotationStatus; partyId: string; number: string }[]>`
      SELECT "status", "partyId", "number" FROM "Quotation" WHERE "id" = ${quotationId}::uuid FOR UPDATE`;
    if (!quotation) fail('That quotation does not exist');
    if (quotation.partyId !== partyId) fail(`Quotation ${quotation.number} is for another customer`);
    const problem = conversionProblem(quotation.status);
    if (problem) throw new ConflictException(problem);
    await tx.quotation.update({ where: { id: quotationId }, data: { status: 'CONVERTED' } });
  }

  /** The LUT ARN in force on the date, copied onto the invoice. */
  private async lutOn(tx: Tx, date: string): Promise<string> {
    const day = dateOnly(date);
    const lut = await tx.lut.findFirst({ where: { validFrom: { lte: day }, validTo: { gte: day } }, select: { arn: true } });
    if (!lut) throw new ConflictException('No LUT covers this date. Add it on GST & export setup, or export with IGST paid.');
    return lut.arn;
  }
}
