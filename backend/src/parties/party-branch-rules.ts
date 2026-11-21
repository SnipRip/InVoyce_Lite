// A party's branches, contacts, licences and MSME standing.
//
// One party is one trade name and one ledger (a multi-address ledger):
// "Prasad Traders" bought from in Bihar and in Jharkhand is still one vendor
// for every report. Each GSTIN is a distinct person for GST (CGST Act
// s.25(4)), so a document records which branch it was raised on, and that
// branch's GSTIN and state decide the tax. The party's own fields are its
// main branch; `PartyBranch` rows are the rest.
import { gstinPan, gstinProblem, gstinStateCode, STATE_CODES } from '../common/gst/gstin.js';
import type {
  GstTreatment,
  MsmeActivity,
  MsmeCategory,
  PartyBranchKind,
  PartyLicenceKind,
} from '../generated/prisma/enums.js';
import { needsGstin } from './party-rules.js';

/** Treatments a branch may have: branches are in India. */
export const BRANCH_TREATMENTS: GstTreatment[] = ['REGISTERED', 'COMPOSITION', 'UNREGISTERED', 'CONSUMER', 'SEZ'];

export interface BranchFacts {
  kind: PartyBranchKind;
  name: string;
  treatment: GstTreatment | null;
  gstin: string | null;
  placeOfSupply: string | null;
}

/** The party as a branch's rules see it: its main GSTIN and PAN. */
export interface BranchOwner {
  treatment: GstTreatment;
  gstin: string | null;
  pan: string | null;
}

/**
 * Fills what follows: a delivery address carries no GST details, a branch
 * with a GSTIN takes its state from it, a branch with no treatment takes the
 * party's.
 */
export function settleBranch<T extends BranchFacts>(branch: T, owner: BranchOwner): T {
  const settled = { ...branch };
  if (branch.kind === 'SHIP_TO') {
    settled.treatment = null;
    settled.gstin = null;
    return settled;
  }
  settled.treatment ??= owner.treatment === 'OVERSEAS' ? 'REGISTERED' : owner.treatment;
  if (!needsGstin(settled.treatment)) settled.gstin = null;
  if (settled.gstin && !gstinProblem(settled.gstin) && settled.treatment !== 'SEZ') {
    settled.placeOfSupply = gstinStateCode(settled.gstin);
  }
  return settled;
}

/** Null when the branch fits, else the first problem, naming the branch. */
export function branchProblem(branch: BranchFacts, owner: BranchOwner): string | null {
  const name = branch.name.trim();
  if (!name) return 'Give every branch and delivery address a name';
  const say = (text: string) => `${name}: ${text}`;
  if (!branch.placeOfSupply) return say('pick the state');
  if (!STATE_CODES.has(branch.placeOfSupply)) return say('unknown GST state code');
  if (branch.kind === 'SHIP_TO') return null;

  const treatment = branch.treatment!;
  if (!BRANCH_TREATMENTS.includes(treatment)) return say('a branch is in India; pick its GST treatment');
  if (needsGstin(treatment)) {
    if (!branch.gstin) return say('enter the GSTIN');
    const problem = gstinProblem(branch.gstin);
    if (problem) return say(problem);
    // Same PAN = same business. Another PAN is another business: its own party.
    const pan = owner.pan ?? (owner.gstin ? gstinPan(owner.gstin) : null);
    if (pan && gstinPan(branch.gstin) !== pan) {
      return say(`the GSTIN is under PAN ${gstinPan(branch.gstin)}, not this party's ${pan}; a different PAN is a different business, so add it as its own party`);
    }
  } else if (branch.gstin) {
    return say('only registered, composition and SEZ branches have a GSTIN');
  }
  return null;
}

/** GSTINs used by more than one of the party's places in different states, which cannot be. */
export function gstinStateClash(places: { gstin: string | null; placeOfSupply: string | null; name: string }[]): string | null {
  const stateOf = new Map<string, string>();
  for (const place of places) {
    if (!place.gstin || !place.placeOfSupply) continue;
    const seen = stateOf.get(place.gstin);
    if (seen && seen !== place.placeOfSupply) return `${place.name}: GSTIN ${place.gstin} is used in another state`;
    stateOf.set(place.gstin, place.placeOfSupply);
  }
  return null;
}

export interface MsmeFacts {
  udyamNumber: string | null;
  msmeCategory?: MsmeCategory | null;
  msmeActivity?: MsmeActivity | null;
}

/**
 * Whether the 45-day payment rule protects this party (MSMED Act s.15–16;
 * Income-tax s.43B(h) disallows what is unpaid past it at year end): a micro
 * or small enterprise that manufactures or provides services. Medium
 * enterprises and traders are not covered. A Udyam number with no category
 * recorded is treated as covered, the safe side.
 */
export function msmeProtected(party: MsmeFacts): boolean {
  if (!party.udyamNumber) return false;
  if (party.msmeCategory === 'MEDIUM') return false;
  if (party.msmeActivity === 'TRADING') return false;
  return true;
}

/** Category and activity mean nothing without a Udyam number. */
export function settleMsme<T extends MsmeFacts>(party: T): T {
  return party.udyamNumber ? party : { ...party, msmeCategory: null, msmeActivity: null };
}

/** FSSAI licence and registration numbers are 14 digits. */
export const FSSAI_PATTERN = /^\d{14}$/;

export function licenceProblem(licence: { kind: PartyLicenceKind; label: string | null; number: string }): string | null {
  if (!licence.number.trim()) return 'Enter the licence number';
  if (licence.kind === 'FSSAI' && !FSSAI_PATTERN.test(licence.number)) return 'FSSAI licence number is 14 digits';
  if (licence.kind === 'IEC' && !/^[A-Z0-9]{10}$/.test(licence.number)) return 'IEC is 10 characters';
  if (licence.kind === 'OTHER' && !licence.label?.trim()) return 'Say what the other licence is';
  return null;
}
