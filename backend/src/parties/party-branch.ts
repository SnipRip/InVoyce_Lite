// The branch a document is raised on, loaded inside the document's save.
// Bills take the vendor's billing branch, quotations and invoices the
// customer's bill-to branch (GST) and ship-to (where the goods go).
import { BadRequestException } from '@nestjs/common';
import type { GstTreatment, Prisma } from '../generated/prisma/client.js';

type Db = Prisma.TransactionClient;

export interface BranchRow {
  id: string;
  name: string;
  kind: 'BRANCH' | 'SHIP_TO';
  treatment: GstTreatment | null;
  gstin: string | null;
  placeOfSupply: string;
  addressLine: string | null;
  city: string | null;
  pin: string | null;
}

/**
 * The party's live branch, locked `FOR SHARE` so its GST details cannot
 * change under the save. `billing`: it must be a branch with GST details,
 * not a delivery address only. Null when no branch was picked (main branch).
 */
export async function partyBranch(db: Db, partyId: string, branchId: string | null | undefined, use: 'billing' | 'delivery'): Promise<BranchRow | null> {
  if (!branchId) return null;
  const [row] = await db.$queryRaw<(BranchRow & { partyId: string; isArchived: boolean })[]>`
    SELECT "id", "partyId", "name", "kind", "treatment", "gstin", "placeOfSupply", "addressLine", "city", "pin", "isArchived"
    FROM "PartyBranch" WHERE "id" = ${branchId}::uuid FOR SHARE`;
  if (!row || row.partyId !== partyId) throw new BadRequestException('That branch is not this party\'s');
  if (row.isArchived) throw new BadRequestException(`${row.name} is archived`);
  if (use === 'billing' && row.kind !== 'BRANCH') throw new BadRequestException(`${row.name} is a delivery address only; bill a branch with GST details`);
  const { partyId: _party, isArchived: _archived, ...branch } = row;
  return branch;
}

/** The party with the billed branch's GST details in place of its main ones. */
export function billedAs<T extends { treatment: GstTreatment; placeOfSupply: string | null }>(party: T, branch: BranchRow | null): T {
  if (!branch) return party;
  return { ...party, treatment: branch.treatment ?? party.treatment, placeOfSupply: branch.placeOfSupply };
}

/** What a document view shows of the branch it was raised on. */
export const branchSelect = { select: { id: true, name: true, gstin: true, placeOfSupply: true, addressLine: true, city: true, pin: true } } as const;
