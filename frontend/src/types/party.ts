// A customer or vendor as the backend returns it (backend/src/parties).
// Its own GST and address fields are its main branch; `branches` are the rest.
export type GstTreatmentCode = "REGISTERED" | "COMPOSITION" | "UNREGISTERED" | "CONSUMER";

export interface PartyBranchView {
  id: string;
  /** BRANCH: own GST details, can be billed. SHIP_TO: a delivery address only. */
  kind: "BRANCH" | "SHIP_TO";
  name: string;
  treatment: GstTreatmentCode | null;
  gstin: string | null;
  placeOfSupply: string;
  addressLine: string | null;
  city: string | null;
  pin: string | null;
  isArchived: boolean;
}

export interface PartyContactView {
  id: string;
  /** Null: the main branch. */
  branchId: string | null;
  name: string;
  designation: string | null;
  phone: string | null;
  email: string | null;
  whatsapp: boolean;
}

export type LicenceKind = "FSSAI" | "DRUG" | "TRADE" | "SHOP_ESTABLISHMENT" | "OTHER";

export interface PartyLicenceView {
  id: string;
  branchId: string | null;
  kind: LicenceKind;
  label: string | null;
  number: string;
  validUntil: string | null;
}

/** The branch a document was raised on, as document views return it. */
export interface DocumentBranch {
  id: string;
  name: string;
  gstin: string | null;
  placeOfSupply: string;
  addressLine: string | null;
  city: string | null;
  pin: string | null;
}

export interface PartyView {
  id: string;
  isCustomer: boolean;
  isVendor: boolean;
  kind: "BUSINESS" | "INDIVIDUAL";
  displayName: string;
  legalName: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  treatment: GstTreatmentCode;
  gstin: string | null;
  pan: string | null;
  placeOfSupply: string | null;
  isGta: boolean;
  /** Vendors without a GSTIN: transporter ID on e-way bills. */
  transin: string | null;
  addressLine: string | null;
  city: string | null;
  pin: string | null;
  creditDays: number;
  creditLimit: number | null;
  /** Customers only. */
  openingBalance: number;
  openingBalanceSide: "RECEIVABLE" | "PAYABLE";
  udyamNumber: string | null;
  msmeCategory: "MICRO" | "SMALL" | "MEDIUM" | null;
  msmeActivity: "MANUFACTURING" | "SERVICES" | "TRADING" | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  ifsc: string | null;
  notes: string | null;
  isArchived: boolean;
  /** What they owe us; negative when we owe them. Opening balance until postings exist. */
  balance: number;
  branches: PartyBranchView[];
  contacts: PartyContactView[];
  licences: PartyLicenceView[];
}
