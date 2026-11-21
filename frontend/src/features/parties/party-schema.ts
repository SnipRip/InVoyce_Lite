import { z } from "zod";
import { needsGstin } from "@/features/gst/gst-rules";
import { checkGstin, gstinPan, gstinStateCode } from "@/features/gst/gstin";

const amount = z.union([z.literal(""), z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Enter an amount in rupees")]);
const phone = z.string().trim().regex(/^$|^\+[1-9]\d{7,14}$/, "Use the country code, for example +919876543210");

/** A branch or delivery address. `key` is the stored id, or a new one's client key. */
const branchSchema = z
  .object({
    key: z.string(),
    stored: z.boolean(),
    kind: z.enum(["branch", "ship-to"]),
    name: z.string().trim().min(1, "Name it, for example Ranchi branch").max(80),
    treatment: z.enum(["registered", "composition", "unregistered", "consumer"]),
    gstin: z.string().trim().toUpperCase(),
    stateCode: z.string(),
    line1: z.string().trim().max(160),
    city: z.string().trim().max(60),
    pin: z.union([z.literal(""), z.string().regex(/^\d{6}$/, "PIN code is 6 digits")]),
    archived: z.boolean(),
  })
  .superRefine((branch, context) => {
    if (branch.kind === "branch" && needsGstin(branch.treatment)) {
      const check = checkGstin(branch.gstin);
      if (!check.valid) context.addIssue({ code: "custom", path: ["gstin"], message: check.reason });
    }
    if (!branch.stateCode) context.addIssue({ code: "custom", path: ["stateCode"], message: "Pick the state" });
  });

/** `branch`: MAIN_BRANCH ("main") for the main branch, else a branch's key. */
const contactSchema = z.object({
  branch: z.string(),
  name: z.string().trim().min(1, "Enter the name").max(80),
  designation: z.string().trim().max(60),
  phone,
  email: z.union([z.literal(""), z.email("Enter a valid email")]),
  whatsapp: z.boolean(),
});

const licenceSchema = z
  .object({
    branch: z.string(),
    kind: z.enum(["FSSAI", "DRUG", "TRADE", "SHOP_ESTABLISHMENT", "OTHER"]),
    label: z.string().trim().max(60),
    number: z.string().trim().toUpperCase().min(1, "Enter the number").max(40),
    validUntil: z.string(),
  })
  .superRefine((licence, context) => {
    if (licence.kind === "FSSAI" && !/^\d{14}$/.test(licence.number)) context.addIssue({ code: "custom", path: ["number"], message: "FSSAI number is 14 digits" });
    if (licence.kind === "OTHER" && !licence.label) context.addIssue({ code: "custom", path: ["label"], message: "Say what licence it is" });
  });

export type BranchFormValues = z.infer<typeof branchSchema>;
export type ContactFormValues = z.infer<typeof contactSchema>;
export type LicenceFormValues = z.infer<typeof licenceSchema>;

const days = z.string().trim().regex(/^\d{1,3}$/, "Enter the number of days, 0 for cash");

export const partySchema = z
  .object({
    roles: z.array(z.enum(["customer", "vendor"])).min(1, "Pick customer, vendor or both"),
    kind: z.enum(["business", "individual"]),
    displayName: z.string().trim().min(2, "Enter the name to show on documents").max(100),
    legalName: z.string().trim().max(120),
    contactPerson: z.string().trim().max(80),
    phone,
    email: z.union([z.literal(""), z.email("Enter a valid email")]),

    treatment: z.enum(["registered", "composition", "unregistered", "consumer"]),
    gstin: z.string().trim().toUpperCase(),
    pan: z.union([z.literal(""), z.string().trim().toUpperCase().regex(/^[A-Z]{5}\d{4}[A-Z]$/, "PAN is 5 letters, 4 digits, 1 letter")]),
    placeOfSupply: z.string(),
    isGta: z.boolean(),
    /** Vendors without a GSTIN (backend: TRANSIN_PATTERN). */
    transin: z.union([z.literal(""), z.string().trim().toUpperCase().regex(/^\d{2}[A-Z0-9]{13}$/, "15 characters: the state code, then 13 letters or digits")]),

    addressLine: z.string().trim().max(160),
    city: z.string().trim().max(60),
    pin: z.union([z.literal(""), z.string().regex(/^\d{6}$/, "PIN code is 6 digits")]),

    creditDays: days,
    creditLimit: amount,
    openingBalance: amount,
    /** Asked only of a party that is both customer and vendor. */
    openingBalanceSide: z.enum(["receivable", "payable"]),
    msmeCategory: z.enum(["", "micro", "small", "medium"]),
    msmeActivity: z.enum(["", "manufacturing", "services", "trading"]),
    branches: z.array(branchSchema),
    contacts: z.array(contactSchema),
    licences: z.array(licenceSchema),
    udyamNumber: z.union([z.literal(""), z.string().trim().toUpperCase().regex(/^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/, "Format: UDYAM-WB-00-0000000")]),
    bankName: z.string().trim().max(80),
    bankAccount: z.union([z.literal(""), z.string().regex(/^\d{9,18}$/, "Account number is 9 to 18 digits")]),
    ifsc: z.union([z.literal(""), z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "IFSC is 11 characters, like SBIN0001234")]),
    notes: z.string().max(500),
  })
  .superRefine((values, context) => {
    if (needsGstin(values.treatment)) {
      const check = checkGstin(values.gstin);
      if (!check.valid) context.addIssue({ code: "custom", path: ["gstin"], message: check.reason });
      else if (values.placeOfSupply && gstinStateCode(values.gstin) !== values.placeOfSupply) {
        context.addIssue({ code: "custom", path: ["placeOfSupply"], message: "Does not match the state in the GSTIN" });
      }
    }
    if (!values.placeOfSupply) {
      context.addIssue({ code: "custom", path: ["placeOfSupply"], message: "Pick the place of supply" });
    }
    // Same PAN = same business; another PAN is its own party.
    const pan = values.pan || (checkGstin(values.gstin).valid ? gstinPan(values.gstin) : "");
    values.branches.forEach((branch, index) => {
      if (branch.kind === "branch" && pan && checkGstin(branch.gstin).valid && gstinPan(branch.gstin) !== pan) {
        context.addIssue({ code: "custom", path: ["branches", index, "gstin"], message: `PAN ${gstinPan(branch.gstin)} is another business: add it as its own party` });
      }
    });
    const names = values.branches.map((branch) => branch.name.trim().toLowerCase());
    names.forEach((name, index) => {
      if (name && names.indexOf(name) !== index) context.addIssue({ code: "custom", path: ["branches", index, "name"], message: "Another branch has this name" });
    });
  });

export type PartyFormValues = z.infer<typeof partySchema>;
