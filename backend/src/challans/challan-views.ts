// A delivery challan as the API returns it.
import { isoDate } from '../common/dates.js';
import { toNumber } from '../common/decimal.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { DeliveryChallanStatus } from '../generated/prisma/enums.js';

export const challanInclude = {
  party: { select: { displayName: true } },
  godown: { select: { name: true } },
  quotation: { select: { id: true, number: true, revision: true } },
  invoice: { select: { id: true, number: true } },
  createdBy: { select: { displayName: true } },
  lines: { orderBy: { position: 'asc' }, include: { item: { select: { name: true, sku: true, hsn: true } } } },
} satisfies Prisma.DeliveryChallanInclude;

export interface ChallanView {
  id: string;
  number: string;
  date: string;
  partyId: string;
  partyName: string;
  godownId: string;
  godownName: string;
  quotation: { id: string; number: string } | null;
  status: DeliveryChallanStatus;
  invoice: { id: string; number: string } | null;
  shipToLine: string | null;
  shipToCity: string | null;
  vehicleNumber: string | null;
  notes: string | null;
  value: number;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdBy: string | null;
  lines: { id: string; itemId: string; itemName: string; sku: string | null; hsn: string | null; unit: string; quantity: number; rate: number; description: string | null }[];
}

type ChallanRow = Prisma.DeliveryChallanGetPayload<{ include: typeof challanInclude }>;

export function toChallanView(row: ChallanRow): ChallanView {
  return {
    id: row.id,
    number: row.number,
    date: isoDate(row.date),
    partyId: row.partyId,
    partyName: row.party.displayName,
    godownId: row.godownId,
    godownName: row.godown.name,
    quotation: row.quotation ? { id: row.quotation.id, number: row.quotation.revision ? `${row.quotation.number}-R${row.quotation.revision}` : row.quotation.number } : null,
    status: row.status,
    invoice: row.invoice,
    shipToLine: row.shipToLine,
    shipToCity: row.shipToCity,
    vehicleNumber: row.vehicleNumber,
    notes: row.notes,
    value: toNumber(row.value),
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    cancelReason: row.cancelReason,
    createdBy: row.createdBy?.displayName ?? null,
    lines: row.lines.map((line) => ({
      id: line.id,
      itemId: line.itemId,
      itemName: line.item.name,
      sku: line.item.sku,
      hsn: line.item.hsn,
      unit: line.unit,
      quantity: toNumber(line.quantity),
      rate: toNumber(line.rate),
      description: line.description,
    })),
  };
}
