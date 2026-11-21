// Which GST applies to a sale or a purchase, decided from the party's GST
// treatment and place of supply, as GST law sets it. No React here:
// invoices, bills and the party forms all call these.
//
// Sale inside our state → CGST + SGST (half the rate each); to another state
// → IGST (full rate).
//
// When we are a composition dealer or unregistered (company profile), we
// charge no GST (bill of supply), may sell only inside our state, and can
// claim none of the GST we pay. The backend decides the same in
// src/sale-pricing/sale-rules.ts and src/purchases/purchase-rules.ts.
import type { OurRegistration } from "@/types/company";
import { stateName } from "./indian-states";

export type GstTreatment = "registered" | "composition" | "unregistered" | "consumer";

export const GST_TREATMENTS: { value: GstTreatment; label: string; hint: string }[] = [
  { value: "registered", label: "Registered business, regular", hint: "Has a GSTIN and charges GST" },
  { value: "composition", label: "Registered business, composition", hint: "Has a GSTIN but issues a bill of supply without GST" },
  { value: "unregistered", label: "Unregistered business", hint: "No GSTIN" },
  { value: "consumer", label: "Consumer", hint: "An individual buying for own use" },
];

export const treatmentLabel = (treatment: GstTreatment) => GST_TREATMENTS.find((option) => option.value === treatment)?.label ?? treatment;

/** Treatments that come with a GSTIN. */
export const needsGstin = (treatment: GstTreatment) => treatment === "registered" || treatment === "composition";

export type TaxComponent = { name: "CGST" | "SGST" | "IGST"; ratePct: number };

export type Regime = "intra-state" | "inter-state" | "no-gst" | "reverse-charge";

export interface TaxDecision {
  regime: Regime;
  /** One line for chips: "CGST + SGST". */
  title: string;
  /** Why, in a sentence. */
  detail: string;
  /** Can we claim this GST back as input tax credit? Purchases only. */
  itc?: boolean;
  /** Set when we may not make this sale at all (composition or unregistered, outside our state). */
  blocked?: string;
}

/** Whether we charge GST and claim it back: only a regular registration does. */
export const chargesGst = (company: OurRegistration) => company.registration === "REGULAR";

export const REGISTRATION_OPTIONS: { value: OurRegistration["registration"]; label: string; hint: string }[] = [
  { value: "REGULAR", label: "Regular GST", hint: "Tax invoices with CGST + SGST or IGST, input credit claimed" },
  { value: "COMPOSITION", label: "Composition scheme", hint: "Bill of supply, no GST charged, no input credit, sales only inside our state" },
  { value: "UNREGISTERED", label: "Not registered", hint: "No GSTIN: plain invoices, no GST, no input credit, sales only inside our state" },
];

const ourStatus = (company: OurRegistration) => (company.registration === "COMPOSITION" ? "We are a composition dealer" : "We are not registered under GST");

/**
 * How we were registered when a stored document was issued, from its regime:
 * a bill of supply was issued without GST, anything else with. Prints old
 * documents right after the registration changes.
 */
export function registrationOn(company: OurRegistration, storedRegime?: string): OurRegistration {
  if (!storedRegime) return company;
  if (storedRegime !== "BILL_OF_SUPPLY") return { ...company, registration: "REGULAR" };
  return chargesGst(company) ? { ...company, registration: "COMPOSITION" } : company;
}

/** Why a sale outside our state is refused. Same words as the backend. */
export const outsideStateProblem = (company: OurRegistration) =>
  company.registration === "COMPOSITION"
    ? "A composition dealer can sell only inside its own state: no other-state sales"
    : "An unregistered business can sell only inside its own state: register for GST to sell to other states";

export interface PartyTaxProfile {
  treatment: GstTreatment;
  /** GST state code of the place of supply. */
  stateCode?: string;
  /** Vendor is a goods transport agency: freight falls under reverse charge. */
  isGta?: boolean;
}

export function saleTax(company: OurRegistration, party: PartyTaxProfile): TaxDecision {
  const regular = regularSale(company.stateCode, party);
  if (chargesGst(company)) return regular;
  if (regular.regime !== "intra-state") {
    const blocked = outsideStateProblem(company);
    return { regime: "no-gst", title: "Not allowed", detail: blocked, blocked };
  }
  return {
    regime: "no-gst",
    title: company.registration === "COMPOSITION" ? "Bill of supply · no GST" : "No GST",
    detail: `${ourStatus(company)}, so the invoice charges no GST.`,
  };
}

function regularSale(companyState: string, party: PartyTaxProfile): TaxDecision {
  if (party.stateCode === companyState) {
    return {
      regime: "intra-state",
      title: "CGST + SGST",
      detail: `Place of supply ${stateName(party.stateCode)} is our own state, so the rate is split half CGST, half SGST.`,
    };
  }
  return {
    regime: "inter-state",
    title: "IGST",
    detail: `Place of supply ${stateName(party.stateCode) ?? "another state"} is outside our state, so the full rate is IGST.`,
  };
}

export function purchaseTax(company: OurRegistration, vendor: PartyTaxProfile): TaxDecision {
  const regular = regularPurchase(company.stateCode, vendor);
  if (chargesGst(company) || !regular.itc) return regular;
  if (regular.regime === "reverse-charge" && company.registration === "UNREGISTERED") {
    return { regime: "no-gst", title: "No GST", detail: "Freight from a goods transport agency to an unregistered business carries no GST.", itc: false };
  }
  return { ...regular, detail: `${regular.title} on the bill. ${ourStatus(company)}, so none of it can be claimed: it is part of the cost.`, itc: false };
}

function regularPurchase(companyState: string, vendor: PartyTaxProfile): TaxDecision {
  if (vendor.isGta) {
    return {
      regime: "reverse-charge",
      title: "Reverse charge",
      detail: "Freight from a goods transport agency: the transporter charges no GST, we pay it under reverse charge and claim it back.",
      itc: true,
    };
  }
  switch (vendor.treatment) {
    case "composition":
      return {
        regime: "no-gst",
        title: "Bill of supply · no GST",
        detail: "A composition dealer cannot charge GST. The full bill amount is our cost and there is nothing to claim back.",
        itc: false,
      };
    case "unregistered":
    case "consumer":
      return {
        regime: "no-gst",
        title: "No GST bill",
        detail: "No GSTIN, so no tax invoice. The full amount is our cost and there is no input tax credit.",
        itc: false,
      };
    default:
      return vendor.stateCode === companyState
        ? {
            regime: "intra-state",
            title: "CGST + SGST",
            detail: "Vendor is in our state: GST bill with CGST + SGST, claimable as input tax credit.",
            itc: true,
          }
        : {
            regime: "inter-state",
            title: "IGST",
            detail: `Vendor is in ${stateName(vendor.stateCode) ?? "another state"}: GST bill with IGST, claimable as input tax credit.`,
            itc: true,
          };
  }
}

/** How a rate splits on the document. Empty when no GST is charged. */
export function taxComponents(ratePct: number, regime: Regime): TaxComponent[] {
  switch (regime) {
    case "intra-state":
      return [
        { name: "CGST", ratePct: ratePct / 2 },
        { name: "SGST", ratePct: ratePct / 2 },
      ];
    case "inter-state":
      return [{ name: "IGST", ratePct }];
    default:
      return [];
  }
}

/** "CGST 9% + SGST 9%" or "No GST". */
export function describeComponents(ratePct: number, regime: Regime): string {
  if (regime === "reverse-charge") return `${ratePct}% paid by us under reverse charge`;
  const components = taxComponents(ratePct, regime);
  if (components.length === 0) return "No GST";
  return components.map((component) => `${component.name} ${component.ratePct}%`).join(" + ");
}
