// A vehicle as the API returns it.
import { toNumber } from '../common/decimal.js';
import type { Prisma } from '../generated/prisma/client.js';

export const vehicleInclude = {
  transporter: { select: { displayName: true } },
  _count: { select: { invoices: true, stockTransfers: true } },
} as const satisfies Prisma.VehicleInclude;

type VehicleRow = Prisma.VehicleGetPayload<{ include: typeof vehicleInclude }>;

export const toVehicleView = ({ transporter, _count, capacityTons, ...vehicle }: VehicleRow) => ({
  ...vehicle,
  capacityTons: capacityTons === null ? null : toNumber(capacityTons),
  transporterName: transporter?.displayName ?? null,
  /** Invoices and stock transfers that carried it (cancelled ones too): a used vehicle is archived, not deleted. */
  useCount: _count.invoices + _count.stockTransfers,
});

export type VehicleView = ReturnType<typeof toVehicleView>;
