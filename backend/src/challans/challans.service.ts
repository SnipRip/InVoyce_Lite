import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { dateOnly, todayInIndia } from '../common/dates.js';
import { PrismaService } from '../database/prisma.service.js';
import { loadItemFacts } from '../items/item-document-facts.js';
import { NumberSeriesService } from '../number-series/number-series.service.js';
import { liveGodown } from '../purchases/purchase-context.js';
import { challanLinesProblem } from './challan-rules.js';
import { challanStock } from './challan-stock.js';
import { challanInclude, toChallanView, type ChallanView } from './challan-views.js';
import type { CreateChallanDto } from './dto/challan.dto.js';
import { lockRows } from '../database/sql.js';

const fail = (message: string | null) => {
  if (message) throw new BadRequestException(message);
};

// Delivery challans (client, 12 Nov 2026; challan-rules.ts): goods sent ahead
// of the invoice. The godown row is locked while the stock is checked, so two
// challans never both send the last units. An invoice raised from a challan
// marks it invoiced (invoices.service.ts); cancelling that invoice opens it again.
@Injectable()
export class ChallansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbers: NumberSeriesService,
  ) {}

  async list(): Promise<ChallanView[]> {
    const rows = await this.prisma.deliveryChallan.findMany({ include: challanInclude, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }] });
    return rows.map(toChallanView);
  }

  async get(id: string): Promise<ChallanView> {
    return toChallanView(await this.prisma.deliveryChallan.findUniqueOrThrow({ where: { id }, include: challanInclude }));
  }

  create(dto: CreateChallanDto, userId: string): Promise<ChallanView> {
    if (dto.date > todayInIndia()) fail('A challan cannot be dated after today');
    return this.prisma.$transaction(
      async (tx) => {
        const party = await tx.party.findUnique({ where: { id: dto.partyId }, select: { isCustomer: true, isArchived: true, displayName: true } });
        if (!party || !party.isCustomer) fail('Pick a customer');
        if (party!.isArchived) fail(`${party!.displayName} is archived`);
        await liveGodown(tx, dto.godownId);
        await lockRows(tx, 'Godown', dto.godownId);
        if (dto.quotationId) {
          const quotation = await tx.quotation.findUnique({ where: { id: dto.quotationId }, select: { partyId: true, status: true, number: true } });
          if (!quotation || quotation.partyId !== dto.partyId) fail('The quotation is for another customer');
          if (!['SENT', 'ACCEPTED'].includes(quotation!.status)) fail(`Quotation ${quotation!.number} is not open: only a sent or accepted quotation can be dispatched`);
        }
        const stock = await challanStock(tx, dto.godownId, dto.lines.map((line) => line.itemId));
        fail(challanLinesProblem(dto.lines, stock));
        const facts = await loadItemFacts(tx, dto.lines.map((line) => line.itemId), dto.date);
        const value = Math.round(dto.lines.reduce((sum, line) => sum + line.quantity * (line.rate ?? 0), 0) * 100) / 100;

        const claimed = await this.numbers.issue(tx, 'DELIVERY_CHALLAN', dto.date, { typed: dto.number ?? undefined });
        const challan = await tx.deliveryChallan.create({
          data: {
            number: claimed.number,
            issuedNumberId: claimed.id,
            date: dateOnly(dto.date),
            partyId: dto.partyId,
            godownId: dto.godownId,
            quotationId: dto.quotationId ?? null,
            shipToLine: dto.shipToLine ?? null,
            shipToCity: dto.shipToCity ?? null,
            vehicleNumber: dto.vehicleNumber?.toUpperCase().replace(/\s+/g, '') ?? null,
            notes: dto.notes ?? null,
            value,
            createdById: userId,
            lines: {
              create: dto.lines.map((line, position) => ({
                position,
                itemId: line.itemId,
                unit: facts.get(line.itemId)!.unit,
                quantity: line.quantity,
                rate: line.rate ?? 0,
                description: line.description ?? null,
              })),
            },
          },
          include: challanInclude,
        });
        await tx.issuedNumber.update({ where: { id: claimed.id }, data: { documentId: challan.id } });
        return toChallanView(challan);
      },
      { timeout: 20_000 },
    );
  }

  /** An open challan only: the goods it held are free again and its number is cancelled. */
  cancel(id: string, reason: string): Promise<ChallanView> {
    return this.prisma.$transaction(async (tx) => {
      await lockRows(tx, 'DeliveryChallan', id);
      const current = (await tx.deliveryChallan.findUnique({ where: { id }, select: { status: true, issuedNumberId: true } }))!;
      if (!current) fail('That challan does not exist');
      if (current.status === 'CANCELLED') throw new ConflictException('This challan is already cancelled');
      if (current.status === 'INVOICED') throw new ConflictException('This challan is invoiced; cancel the invoice first');
      await this.numbers.cancel(tx, current.issuedNumberId);
      const row = await tx.deliveryChallan.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason }, include: challanInclude });
      return toChallanView(row);
    });
  }
}
