// Which of a party's places a document can be raised on, and the party as
// that place's GST details make it. The party's own fields are its main
// branch; MAIN_BRANCH stands for it in pickers and form values (a select
// cannot hold "").
import { stateName } from "@/features/gst/indian-states";
import type { Party, PartyBranch } from "./types";

export const MAIN_BRANCH = "main";

/** A picked place as the API takes it: null for the main branch. */
export const branchIdOf = (value: string) => (value && value !== MAIN_BRANCH ? value : null);

const live = (party: Party | undefined) => (party?.branches ?? []).filter((branch) => !branch.archived);

/** Branches with GST details of their own: what a bill or invoice can be raised on. */
export const billingBranches = (party: Party | undefined) => live(party).filter((branch) => branch.kind === "branch");

/** Every live place goods can go to: branches and delivery addresses. */
export const deliveryPlaces = (party: Party | undefined) => live(party);

const where = (city: string, stateCode?: string) => [city, stateCode ? stateName(stateCode) : ""].filter(Boolean).join(", ");

/** Picker label: "Main · Patna, Bihar · 10AAB…" / "Ranchi branch · Ranchi, Jharkhand · 20AAB…". */
export function placeLabel(party: Party, branch?: PartyBranch) {
  if (!branch) {
    return ["Main", where(party.billing.city, party.placeOfSupply), party.gstin].filter(Boolean).join(" · ");
  }
  return [branch.name, where(branch.city, branch.stateCode), branch.kind === "branch" ? branch.gstin : "delivery only"].filter(Boolean).join(" · ");
}

export function billingOptions(party: Party | undefined) {
  if (!party) return [];
  return [{ value: MAIN_BRANCH, label: placeLabel(party) }, ...billingBranches(party).map((branch) => ({ value: branch.id, label: placeLabel(party, branch) }))];
}

/** Ship-to choices: "same as bill to" (MAIN_BRANCH) first, then every other place. */
export function deliveryOptions(party: Party | undefined) {
  if (!party) return [];
  return [
    { value: MAIN_BRANCH, label: "Same as bill to" },
    ...deliveryPlaces(party).map((branch) => ({ value: branch.id, label: placeLabel(party, branch) })),
  ];
}

export const findBranch = (party: Party | undefined, id: string | undefined) => (id ? party?.branches?.find((branch) => branch.id === id) : undefined);

/** The party with the billed branch's GST details (treatment, GSTIN, state) in place of its main ones. */
export function billedAs(party: Party, branchId: string | undefined): Party {
  const branch = findBranch(party, branchId);
  if (!branch || branch.kind !== "branch") return party;
  return {
    ...party,
    treatment: branch.treatment ?? party.treatment,
    gstin: branch.gstin,
    placeOfSupply: branch.stateCode,
    billing: { line1: branch.line1, city: branch.city, stateCode: branch.stateCode, pin: branch.pin },
  };
}
