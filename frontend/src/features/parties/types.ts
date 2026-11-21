// Customers and vendors share one shape (one party can be both); `roles` says
// which they are, and one party can be both.
import type { ExportRoute, GstTreatment } from "@/features/gst/gst-rules";
import type { LicenceKind } from "@/types/party";

/**
 * Another place of business (own GST details; can be billed) or a delivery
 * address only. The party's own fields are its main branch.
 */
export interface PartyBranch {
  id: string;
  kind: "branch" | "ship-to";
  name: string;
  /** Branch only. */
  treatment?: GstTreatment;
  gstin?: string;
  /** GST state code. */
  stateCode: string;
  line1: string;
  city: string;
  pin?: string;
  archived: boolean;
}

export interface PartyContact {
  /** Undefined: the main branch. */
  branchId?: string;
  name: string;
  designation?: string;
  phone?: string;
  email?: string;
  whatsapp: boolean;
}

export interface PartyLicence {
  branchId?: string;
  kind: LicenceKind;
  label?: string;
  number: string;
  validUntil?: string;
}

export type MsmeCategory = "micro" | "small" | "medium";
export type MsmeActivity = "manufacturing" | "services" | "trading";

export type PartyRole = "customer" | "vendor";

export interface Address {
  line1: string;
  city: string;
  /** GST state code for India. */
  stateCode?: string;
  /** Outside India only. */
  country?: string;
  pin?: string;
}

export interface Party {
  id: string;
  roles: PartyRole[];
  kind: "business" | "individual";
  displayName: string;
  legalName?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  whatsappOptIn?: boolean;

  treatment: GstTreatment;
  gstin?: string;
  pan?: string;
  /** Place of supply: GST state code. Overseas parties have none. */
  placeOfSupply?: string;
  /** Overseas: the buyer's own tax ID, e.g. Bhutan TPN. */
  foreignTaxId?: string;
  currency: "INR" | "BTN";
  exportRoute?: ExportRoute;

  billing: Address;
  shipping?: Address;

  creditDays: number;
  openingBalance: number;
  /** Which way the opening balance runs. Sample parties leave it out. */
  balanceSide?: "receivable" | "payable";
  /** Customers: what we allow them. Vendors: what they allow us. */
  creditLimit?: number;
  /** MSME registration, customers and vendors alike. */
  udyamNumber?: string;
  msmeCategory?: MsmeCategory;
  msmeActivity?: MsmeActivity;
  isGta?: boolean;
  /** Vendors without a GSTIN: their transporter ID on e-way bills. */
  transin?: string;
  bankAccount?: { name: string; number: string; ifsc: string };

  /** Customers: what they owe. Vendors: what we owe. See dueFor in party-rules.ts. */
  outstanding: number;
  notes?: string;
  archived?: boolean;
  /** Sample parties leave these out. */
  branches?: PartyBranch[];
  contacts?: PartyContact[];
  licences?: PartyLicence[];
}
