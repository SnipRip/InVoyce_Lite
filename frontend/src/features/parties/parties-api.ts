// Calls for the customer and vendor master, and the conversion between the
// backend's party and the one the screens use.
import type { GstTreatment } from "@/features/gst/gst-rules";
import { apiRequest } from "@/lib/api-client";
import type { PartyView } from "@/types/party";
import type { BranchFormValues, PartyFormValues } from "./party-schema";
import type { MsmeActivity, MsmeCategory, Party, PartyRole } from "./types";

export const PARTIES_PATH = "/parties";
/** One list for both screens, archived parties included (behind the Archived filter). */
export const PARTIES_LIST_PATH = `${PARTIES_PATH}?includeArchived=true`;

const orUndefined = <T,>(value: T | null) => value ?? undefined;

export function toParty(view: PartyView): Party {
  const roles: PartyRole[] = [...(view.isCustomer ? ["customer" as const] : []), ...(view.isVendor ? ["vendor" as const] : [])];
  return {
    id: view.id,
    roles,
    kind: view.kind === "INDIVIDUAL" ? "individual" : "business",
    displayName: view.displayName,
    legalName: orUndefined(view.legalName),
    contactPerson: orUndefined(view.contactPerson),
    phone: orUndefined(view.phone),
    email: orUndefined(view.email),
    treatment: view.treatment.toLowerCase() as GstTreatment,
    gstin: orUndefined(view.gstin),
    pan: orUndefined(view.pan),
    placeOfSupply: orUndefined(view.placeOfSupply),
    billing: {
      line1: view.addressLine ?? "",
      city: view.city ?? "",
      stateCode: orUndefined(view.placeOfSupply),
      pin: orUndefined(view.pin),
    },
    creditDays: view.creditDays,
    creditLimit: orUndefined(view.creditLimit),
    openingBalance: view.openingBalance,
    balanceSide: view.openingBalanceSide === "RECEIVABLE" ? "receivable" : "payable",
    udyamNumber: orUndefined(view.udyamNumber),
    msmeCategory: view.msmeCategory ? (view.msmeCategory.toLowerCase() as MsmeCategory) : undefined,
    msmeActivity: view.msmeActivity ? (view.msmeActivity.toLowerCase() as MsmeActivity) : undefined,
    branches: view.branches.map((branch) => ({
      id: branch.id,
      kind: branch.kind === "SHIP_TO" ? ("ship-to" as const) : ("branch" as const),
      name: branch.name,
      treatment: branch.treatment ? (branch.treatment.toLowerCase() as GstTreatment) : undefined,
      gstin: orUndefined(branch.gstin),
      stateCode: branch.placeOfSupply,
      line1: branch.addressLine ?? "",
      city: branch.city ?? "",
      pin: orUndefined(branch.pin),
      archived: branch.isArchived,
    })),
    contacts: view.contacts.map((contact) => ({
      branchId: orUndefined(contact.branchId),
      name: contact.name,
      designation: orUndefined(contact.designation),
      phone: orUndefined(contact.phone),
      email: orUndefined(contact.email),
      whatsapp: contact.whatsapp,
    })),
    licences: view.licences.map((licence) => ({
      branchId: orUndefined(licence.branchId),
      kind: licence.kind,
      label: orUndefined(licence.label),
      number: licence.number,
      validUntil: orUndefined(licence.validUntil),
    })),
    isGta: view.isGta,
    transin: orUndefined(view.transin),
    bankAccount: view.bankAccountNumber
      ? { name: view.bankName ?? "", number: view.bankAccountNumber, ifsc: view.ifsc ?? "" }
      : undefined,
    outstanding: Math.abs(view.balance),
    notes: orUndefined(view.notes),
    archived: view.isArchived,
  };
}

const orNull = (text: string) => text.trim() || null;
const amountOrNull = (text: string) => (text.trim() === "" ? null : Number(text));

/** Where a contact or licence belongs: a stored branch by id, a new one by key, or the main branch. */
function branchLink(key: string, branches: BranchFormValues[]) {
  const branch = branches.find((candidate) => candidate.key === key);
  if (!branch) return { branchId: null, branchKey: null };
  return branch.stored ? { branchId: branch.key, branchKey: null } : { branchId: null, branchKey: branch.key };
}

function childrenBody(values: PartyFormValues) {
  return {
    branches: values.branches.map((branch) => {
      const own = branch.kind === "branch";
      const withGstin = own && (branch.treatment === "registered" || branch.treatment === "composition");
      return {
        ...(branch.stored ? { id: branch.key } : { key: branch.key }),
        kind: own ? "BRANCH" : "SHIP_TO",
        name: branch.name,
        treatment: own ? branch.treatment.toUpperCase() : null,
        gstin: withGstin ? orNull(branch.gstin) : null,
        placeOfSupply: orNull(branch.stateCode),
        addressLine: orNull(branch.line1),
        city: orNull(branch.city),
        pin: orNull(branch.pin),
        isArchived: branch.archived,
      };
    }),
    contacts: values.contacts.map((contact) => ({
      ...branchLink(contact.branch, values.branches),
      name: contact.name,
      designation: orNull(contact.designation),
      phone: orNull(contact.phone),
      email: orNull(contact.email),
      whatsapp: contact.whatsapp,
    })),
    licences: values.licences.map((licence) => ({
      ...branchLink(licence.branch, values.branches),
      kind: licence.kind,
      label: licence.kind === "OTHER" ? orNull(licence.label) : null,
      number: licence.number,
      validUntil: orNull(licence.validUntil),
    })),
  };
}

// Form values → request body. Fields that do not apply to the treatment or
// roles are sent as null; the backend clears them too.
function partyBody(values: PartyFormValues) {
  const withGstin = values.treatment === "registered" || values.treatment === "composition";
  const isCustomer = values.roles.includes("customer");
  const isVendor = values.roles.includes("vendor");
  return {
    isCustomer,
    isVendor,
    kind: values.kind.toUpperCase(),
    displayName: values.displayName,
    legalName: orNull(values.legalName),
    contactPerson: orNull(values.contactPerson),
    phone: orNull(values.phone),
    email: orNull(values.email),
    treatment: values.treatment.toUpperCase(),
    gstin: withGstin ? orNull(values.gstin) : null,
    pan: withGstin ? orNull(values.pan) : null,
    placeOfSupply: orNull(values.placeOfSupply),
    isGta: isVendor && values.isGta,
    transin: isVendor && !withGstin ? orNull(values.transin) : null,
    addressLine: orNull(values.addressLine),
    city: orNull(values.city),
    pin: orNull(values.pin),
    creditDays: Number(values.creditDays),
    creditLimit: amountOrNull(values.creditLimit),
    openingBalance: amountOrNull(values.openingBalance) ?? 0,
    openingBalanceSide: values.openingBalanceSide.toUpperCase(),
    udyamNumber: orNull(values.udyamNumber),
    msmeCategory: values.udyamNumber ? values.msmeCategory.toUpperCase() || null : null,
    msmeActivity: values.udyamNumber ? values.msmeActivity.toUpperCase() || null : null,
    ...childrenBody(values),
    bankName: isVendor ? orNull(values.bankName) : null,
    bankAccountNumber: isVendor ? orNull(values.bankAccount) : null,
    ifsc: isVendor ? orNull(values.ifsc) : null,
    notes: orNull(values.notes),
  };
}

export function saveParty(party: Party | undefined, values: PartyFormValues) {
  const body = partyBody(values);
  return party
    ? apiRequest<PartyView>(`${PARTIES_PATH}/${party.id}`, { method: "PATCH", body })
    : apiRequest<PartyView>(PARTIES_PATH, { method: "POST", body });
}

export const setPartyArchived = (party: Party, archived: boolean) =>
  apiRequest<PartyView>(`${PARTIES_PATH}/${party.id}`, { method: "PATCH", body: { isArchived: archived } });
