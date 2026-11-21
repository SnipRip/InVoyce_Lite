// SAMPLE DATA for sales invoices: invented invoices to sample customers, with
// lines priced from the sample items. Every number (invoice, e-way bill,
// IRN) is a placeholder, not a real document.
import { hsnCodes } from "@/features/hsn/sample-data";
import { resolveItemDefaults } from "@/features/items/item-rules";
import { categories, itemGroups, items, sampleRateSheet } from "@/features/items/sample-data";
import type { Invoice, InvoiceLine } from "./types";

const catalog = { categories, groups: itemGroups, items, hsnCodes };

/** An invoice line for a sample item at its selling price. */
export function lineFor(itemId: string, quantity: number, discountPct = 0, rate?: number): InvoiceLine {
  const item = items.find((candidate) => candidate.id === itemId)!;
  const defaults = resolveItemDefaults(catalog, item);
  return {
    itemId,
    description: item.name,
    hsn: defaults.hsn.value ?? "",
    quantity,
    unit: defaults.unit.value ?? "",
    rate: rate ?? sampleRateSheet.find((entry) => entry.itemId === item.id)?.sellingPrice ?? 0,
    discountPct,
    gstRatePct: defaults.gstRatePct.value ?? 0,
  };
}

/** A made-up 64-character IRN, clearly not a real one. */
const sampleIrn = (n: number) => `${"5a3e".repeat(15)}${String(n).padStart(4, "0")}`;
const sampleEinvoice = (n: number, date: string) => ({ number: sampleIrn(n), date, details: { ackNo: `11262${String(n).padStart(10, "0")}` } });

export const invoices: Invoice[] = [
  {
    id: "inv-2627-0062",
    number: "INV/2627/0062",
    date: "2026-10-21",
    status: "issued",
    partyId: "jalpaiguri-builders",
    placeOfSupply: "19",
    shipTo: { line1: "Site office, Rajganj", city: "Jalpaiguri", stateCode: "19" },
    vehicleNumber: "WB73E4821",
    lines: [lineFor("tmt-12", 4850, 3), lineFor("tmt-16", 2400, 3), lineFor("binding-wire", 8)],
    documents: {
      "e-invoice": sampleEinvoice(1, "2026-10-21"),
      "lorry-challan": { number: "RTL/1187", date: "2026-10-21", details: { transporter: "Royal Transport Lines", vehicle: "WB73E4821", freight: "6500" } },
      "eway-bill": { number: "391000000001", date: "2026-10-21", details: { validUntil: "2026-10-22" } },
    },
  },
  {
    id: "inv-2627-0061",
    number: "INV/2627/0061",
    date: "2026-10-09",
    status: "issued",
    partyId: "cooch-behar-construction",
    placeOfSupply: "19",
    vehicleNumber: "WB74F2210",
    lines: [lineFor("aac-200", 1200, 5), lineFor("aac-150", 600, 5)],
    documents: {
      "lorry-challan": { number: "RTL/1142", date: "2026-10-09", details: { transporter: "Royal Transport Lines", vehicle: "WB74F2210", freight: "4800" } },
      "eway-bill": { number: "391000000002", date: "2026-10-09", details: { validUntil: "2026-10-10" } },
    },
  },
  {
    id: "inv-2627-0063",
    number: "INV/2627/0063",
    date: "2026-10-27",
    status: "draft",
    partyId: "jalpaiguri-builders",
    placeOfSupply: "19",
    lines: [lineFor("ply-18", 40, 2), lineFor("chips-white-2b", 60)],
    documents: {},
  },
  {
    id: "inv-2627-0031",
    number: "INV/2627/0031",
    date: "2026-10-06",
    status: "issued",
    partyId: "siliguri-infra",
    placeOfSupply: "19",
    vehicleNumber: "WB73D7712",
    lines: [lineFor("tmt-10", 1800, 2), lineFor("angle-50", 650), lineFor("nut-bolt", 400)],
    documents: {
      "e-invoice": sampleEinvoice(3, "2026-10-06"),
      "lorry-challan": { number: "RTL/1120", date: "2026-10-06", details: { transporter: "Royal Transport Lines", vehicle: "WB73D7712", freight: "3200" } },
      "eway-bill": { number: "391000000003", date: "2026-10-06", details: { validUntil: "2026-10-07" } },
    },
  },
  {
    id: "inv-2627-0058",
    number: "INV/2627/0058",
    date: "2026-10-24",
    status: "issued",
    partyId: "guwahati-hardware",
    placeOfSupply: "18",
    lines: [lineFor("wire-nail", 30), lineFor("binding-wire", 12), lineFor("hdpe-63", 300)],
    documents: {},
  },
  {
    id: "inv-2627-0059",
    number: "INV/2627/0059",
    date: "2026-10-26",
    status: "issued",
    partyId: "walk-in",
    placeOfSupply: "19",
    lines: [lineFor("dolomite", 4), lineFor("v-belt", 1)],
    documents: {},
  },
];

/** The next number in each series, for the new-invoice form. */
export const nextSequence = 64;
