import { toNumber } from '../common/decimal.js';
import type { Party, PartyBranch, PartyContact, PartyLicence, Prisma } from '../generated/prisma/client.js';

/** What every party read loads with it: branches, contacts, licences. */
export const partyInclude = {
  branches: { orderBy: [{ isArchived: 'asc' }, { name: 'asc' }] },
  contacts: { orderBy: { name: 'asc' } },
  licences: { orderBy: { kind: 'asc' } },
} satisfies Prisma.PartyInclude;

type StoredParty = Party & { branches: PartyBranch[]; contacts: PartyContact[]; licences: PartyLicence[] };

export type PartyBranchView = Omit<PartyBranch, 'partyId' | 'createdAt' | 'updatedAt'>;
export type PartyContactView = Omit<PartyContact, 'partyId'>;
export type PartyLicenceView = Omit<PartyLicence, 'partyId' | 'validUntil'> & { validUntil: string | null };

// A party as the API returns it: amounts as numbers, and the balance worked
// out. The party's own GST and address fields are its main branch; the
// other branches, contacts and licences come with it.
export type PartyView = Omit<
  Party,
  'creditLimit' | 'openingBalance' | 'createdAt' | 'updatedAt'
> & {
  creditLimit: number | null;
  openingBalance: number;
  /** What they owe us; negative when we owe them. */
  balance: number;
  branches: PartyBranchView[];
  contacts: PartyContactView[];
  licences: PartyLicenceView[];
};

export function toPartyView({
  creditLimit,
  openingBalance,
  createdAt: _created,
  updatedAt: _updated,
  branches,
  contacts,
  licences,
  ...party
}: StoredParty): PartyView {
  const opening = toNumber(openingBalance);
  return {
    ...party,
    creditLimit: toNumber(creditLimit),
    openingBalance: opening,
    balance: party.openingBalanceSide === 'RECEIVABLE' ? opening : -opening,
    branches: branches.map(({ partyId: _p, createdAt: _c, updatedAt: _u, ...branch }) => branch),
    contacts: contacts.map(({ partyId: _p, ...contact }) => contact),
    licences: licences.map(({ partyId: _p, validUntil, ...licence }) => ({
      ...licence,
      validUntil: validUntil ? validUntil.toISOString().slice(0, 10) : null,
    })),
  };
}
