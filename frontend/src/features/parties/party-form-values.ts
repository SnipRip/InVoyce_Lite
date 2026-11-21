// A party as form values: the stored party, or a new one ticked for the list
// it was opened from. Shared by the full form and the quick-add dialog.
import { MAIN_BRANCH } from "./party-branches";
import type { PartyFormValues } from "./party-schema";
import type { Party, PartyRole } from "./types";

const text = (value?: number) => (value === undefined ? "" : String(value));

export function toPartyValues(role: PartyRole, party?: Party): PartyFormValues {
  return {
    roles: party?.roles ?? [role],
    kind: party?.kind ?? "business",
    displayName: party?.displayName ?? "",
    legalName: party?.legalName ?? "",
    contactPerson: party?.contactPerson ?? "",
    phone: party?.phone ?? "",
    email: party?.email ?? "",
    treatment: party?.treatment ?? "registered",
    gstin: party?.gstin ?? "",
    pan: party?.pan ?? "",
    placeOfSupply: party?.placeOfSupply ?? "",
    isGta: party?.isGta ?? false,
    transin: party?.transin ?? "",
    addressLine: party?.billing.line1 ?? "",
    city: party?.billing.city ?? "",
    pin: party?.billing.pin ?? "",
    creditDays: text(party?.creditDays ?? 0),
    creditLimit: text(party?.creditLimit),
    openingBalance: text(party?.openingBalance),
    openingBalanceSide: party?.balanceSide ?? (role === "vendor" ? "payable" : "receivable"),
    udyamNumber: party?.udyamNumber ?? "",
    msmeCategory: party?.msmeCategory ?? "",
    msmeActivity: party?.msmeActivity ?? "",
    branches: (party?.branches ?? []).map((branch) => ({
      key: branch.id,
      stored: true,
      kind: branch.kind,
      name: branch.name,
      treatment: branch.treatment ?? "registered",
      gstin: branch.gstin ?? "",
      stateCode: branch.stateCode,
      line1: branch.line1,
      city: branch.city,
      pin: branch.pin ?? "",
      archived: branch.archived,
    })),
    contacts: (party?.contacts ?? []).map((contact) => ({
      branch: contact.branchId ?? MAIN_BRANCH,
      name: contact.name,
      designation: contact.designation ?? "",
      phone: contact.phone ?? "",
      email: contact.email ?? "",
      whatsapp: contact.whatsapp,
    })),
    licences: (party?.licences ?? []).map((licence) => ({
      branch: licence.branchId ?? MAIN_BRANCH,
      kind: licence.kind,
      label: licence.label ?? "",
      number: licence.number,
      validUntil: licence.validUntil ?? "",
    })),
    bankName: party?.bankAccount?.name ?? "",
    bankAccount: party?.bankAccount?.number ?? "",
    ifsc: party?.bankAccount?.ifsc ?? "",
    notes: party?.notes ?? "",
  };
}
