// Saving a party's branches, contacts and licences with the party, in its
// transaction. The rules are in party-branch-rules.ts.
import { BadRequestException, ConflictException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import type { PartyBranchDto, PartyContactDto, PartyLicenceDto } from './dto/party-children.dto.js';
import {
  branchProblem,
  gstinStateClash,
  licenceProblem,
  settleBranch,
  type BranchOwner,
} from './party-branch-rules.js';

type Tx = Prisma.TransactionClient;

const fail = (problem: string | null) => {
  if (problem) throw new BadRequestException(problem);
};

export interface ChildrenDto {
  branches?: PartyBranchDto[];
  contacts?: PartyContactDto[];
  licences?: PartyLicenceDto[];
}

/** The owner's main GSTIN, and every branch GSTIN, belongs to no other party. */
export async function assertGstinsFree(tx: Tx, partyId: string | null, gstins: (string | null)[]) {
  const wanted = [...new Set(gstins.filter((gstin): gstin is string => Boolean(gstin)))];
  if (wanted.length === 0) return;
  const other = partyId ? { not: partyId } : undefined;
  const [party, branch] = await Promise.all([
    tx.party.findFirst({ where: { gstin: { in: wanted }, id: other }, select: { displayName: true, gstin: true } }),
    tx.partyBranch.findFirst({
      where: { gstin: { in: wanted }, partyId: other },
      select: { gstin: true, name: true, party: { select: { displayName: true } } },
    }),
  ]);
  if (party) throw new ConflictException(`GSTIN ${party.gstin} belongs to ${party.displayName}`);
  if (branch) throw new ConflictException(`GSTIN ${branch.gstin} belongs to ${branch.party.displayName} (${branch.name})`);
}

/** Documents raised on each of these branches, so their GST details stay as billed. */
async function branchesInUse(tx: Tx, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const [bills, quotations, billed, shipped] = await Promise.all([
    tx.purchaseBill.findMany({ where: { vendorBranchId: { in: ids } }, select: { vendorBranchId: true }, distinct: ['vendorBranchId'] }),
    tx.quotation.findMany({ where: { billToBranchId: { in: ids } }, select: { billToBranchId: true }, distinct: ['billToBranchId'] }),
    tx.invoice.findMany({ where: { billToBranchId: { in: ids } }, select: { billToBranchId: true }, distinct: ['billToBranchId'] }),
    tx.invoice.findMany({ where: { shipToBranchId: { in: ids } }, select: { shipToBranchId: true }, distinct: ['shipToBranchId'] }),
  ]);
  return new Set(
    [
      ...bills.map((row) => row.vendorBranchId),
      ...quotations.map((row) => row.billToBranchId),
      ...billed.map((row) => row.billToBranchId),
      ...shipped.map((row) => row.shipToBranchId),
    ].filter((id): id is string => Boolean(id)),
  );
}

/**
 * Replaces the party's branches / contacts / licences with what was sent
 * (each list only when sent). Branches already on a document keep their
 * GST details and are archived rather than removed.
 */
export async function saveChildren(
  tx: Tx,
  partyId: string,
  owner: BranchOwner & { displayName: string; placeOfSupply: string | null },
  dto: ChildrenDto,
) {
  const stored = await tx.partyBranch.findMany({ where: { partyId } });
  const keyToId = new Map<string, string>();

  if (dto.branches) {
    const storedById = new Map(stored.map((branch) => [branch.id, branch]));
    const settled = dto.branches.map((branch) => {
      if (branch.id && !storedById.has(branch.id)) fail(`${branch.name}: that branch is not this party's`);
      const facts = settleBranch(
        {
          kind: branch.kind,
          name: branch.name,
          treatment: branch.treatment ?? null,
          gstin: branch.gstin ?? null,
          placeOfSupply: branch.placeOfSupply ?? null,
        },
        owner,
      );
      fail(branchProblem(facts, owner));
      return { dto: branch, facts };
    });
    const names = settled.map(({ facts }) => facts.name.toLowerCase());
    const repeated = names.find((name, index) => names.indexOf(name) !== index);
    if (repeated) fail(`Two branches are called ${repeated}; give each its own name`);
    fail(
      gstinStateClash([
        { gstin: owner.gstin, placeOfSupply: owner.placeOfSupply, name: `${owner.displayName} (main)` },
        ...settled.map(({ facts }) => facts),
      ]),
    );
    await assertGstinsFree(tx, partyId, settled.map(({ facts }) => facts.gstin));

    const inUse = await branchesInUse(tx, stored.map((branch) => branch.id));
    const kept = new Set<string>();
    for (const { dto: branch, facts } of settled) {
      const data = {
        kind: facts.kind,
        name: facts.name,
        treatment: facts.treatment,
        gstin: facts.gstin,
        placeOfSupply: facts.placeOfSupply!,
        addressLine: branch.addressLine ?? null,
        city: branch.city ?? null,
        pin: branch.pin ?? null,
        isArchived: branch.isArchived ?? false,
      };
      if (branch.id) {
        const before = storedById.get(branch.id)!;
        const taxChanged =
          before.kind !== data.kind ||
          before.treatment !== data.treatment ||
          before.gstin !== data.gstin ||
          before.placeOfSupply !== data.placeOfSupply;
        if (taxChanged && inUse.has(branch.id)) {
          fail(`${before.name} is already on bills or invoices, so its GSTIN, state and type stay as they were; add a new branch instead`);
        }
        await tx.partyBranch.update({ where: { id: branch.id }, data });
        kept.add(branch.id);
      } else {
        const created = await tx.partyBranch.create({ data: { ...data, partyId }, select: { id: true } });
        if (branch.key) keyToId.set(branch.key, created.id);
      }
    }
    for (const branch of stored) {
      if (kept.has(branch.id)) continue;
      if (inUse.has(branch.id)) await tx.partyBranch.update({ where: { id: branch.id }, data: { isArchived: true } });
      else await tx.partyBranch.delete({ where: { id: branch.id } });
    }
  }

  // A contact or licence points at a stored branch, a new one by key, or the main branch.
  const liveIds = new Set((await tx.partyBranch.findMany({ where: { partyId }, select: { id: true } })).map((row) => row.id));
  const branchOf = (row: { branchId?: string | null; branchKey?: string | null }) => {
    if (row.branchKey) {
      const id = keyToId.get(row.branchKey);
      if (!id) fail('A contact or licence points at a branch that was not sent');
      return id!;
    }
    if (row.branchId) {
      if (!liveIds.has(row.branchId)) fail('A contact or licence points at a branch that is not this party\'s');
      return row.branchId;
    }
    return null;
  };

  if (dto.contacts) {
    await tx.partyContact.deleteMany({ where: { partyId } });
    if (dto.contacts.length > 0) {
      await tx.partyContact.createMany({
        data: dto.contacts.map((contact) => ({
          partyId,
          branchId: branchOf(contact),
          name: contact.name,
          designation: contact.designation ?? null,
          phone: contact.phone ?? null,
          email: contact.email ?? null,
          whatsapp: contact.whatsapp ?? false,
        })),
      });
    }
  }

  if (dto.licences) {
    for (const licence of dto.licences) fail(licenceProblem({ kind: licence.kind, label: licence.label ?? null, number: licence.number }));
    await tx.partyLicence.deleteMany({ where: { partyId } });
    if (dto.licences.length > 0) {
      await tx.partyLicence.createMany({
        data: dto.licences.map((licence) => ({
          partyId,
          branchId: branchOf(licence),
          kind: licence.kind,
          label: licence.kind === 'OTHER' ? (licence.label ?? null) : null,
          number: licence.number,
          validUntil: licence.validUntil ? new Date(`${licence.validUntil}T00:00:00Z`) : null,
        })),
      });
    }
  }
}
