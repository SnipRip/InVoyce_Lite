// A transport vendor as the transporters view returns it. A transporter is a
// vendor (Party): no table of its own, so freight bills and vehicles point
// at the same record.
import type { Prisma } from '../generated/prisma/client.js';

/** Vendors that bill freight as a GTA or own a hired vehicle on the master. */
export const transporterWhere = {
  isVendor: true,
  OR: [{ isGta: true }, { vehicles: { some: {} } }],
} as const satisfies Prisma.PartyWhereInput;

export const transporterSelect = {
  id: true,
  displayName: true,
  contactPerson: true,
  phone: true,
  treatment: true,
  gstin: true,
  transin: true,
  isGta: true,
  isArchived: true,
  _count: { select: { vehicles: { where: { isArchived: false } } } },
} as const satisfies Prisma.PartySelect;

type TransporterRow = Prisma.PartyGetPayload<{ select: typeof transporterSelect }>;

export const toTransporterView = ({ _count, ...party }: TransporterRow) => ({
  ...party,
  /** Live vehicles on the vehicle master. */
  vehicleCount: _count.vehicles,
});

export type TransporterView = ReturnType<typeof toTransporterView>;
