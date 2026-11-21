"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactNode } from "react";
import { Controller, useForm, useWatch, type FieldPath } from "react-hook-form";
import { mutate } from "swr";
import { FilterChip } from "@/components/ui/filter-chip";
import { FilterGroup } from "@/components/ui/filter-group";
import { SelectField } from "@/components/ui/select-field";
import { StepDialog } from "@/components/ui/step-dialog";
import { TextField } from "@/components/ui/text-field";
import { GST_TREATMENTS, needsGstin } from "@/features/gst/gst-rules";
import { checkGstin, gstinPan, gstinStateCode } from "@/features/gst/gstin";
import { INDIAN_STATES, stateName } from "@/features/gst/indian-states";
import { usePickWhenListed } from "@/lib/use-pick-when-listed";
import type { PartyView } from "@/types/party";
import { PARTIES_PATH, saveParty } from "./parties-api";
import { toPartyValues } from "./party-form-values";
import { partySchema, type PartyFormValues } from "./party-schema";
import type { PartyRole } from "./types";

type Field = FieldPath<PartyFormValues>;

/** The fields each step checks before the next one opens. */
const STEP_FIELDS: Field[][] = [
  ["roles", "kind", "displayName", "contactPerson", "phone", "email"],
  ["treatment", "gstin", "pan", "placeOfSupply", "country", "foreignTaxId", "addressLine", "city", "pin"],
  ["creditDays", "openingBalance", "creditLimit", "transin"],
];

const STATE_OPTIONS = INDIAN_STATES.map((state) => ({
  value: state.code,
  label: `${state.name} (${state.code})`,
}));

/** Every list of parties is cached under a key starting with /parties. */
export const reloadParties = () => mutate((key) => typeof key === "string" && key.startsWith(PARTIES_PATH));

interface QuickAddPartyProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: PartyRole;
  /** Gets the saved party once the lists have reloaded, so the picker can show its name. */
  onCreated: (party: PartyView) => void;
}

const fullWidth = "sm:col-span-2";

// A new customer or vendor from the "+" beside a party picker, in three short
// steps that each fit the screen. Branches, contacts, licences and bank
// details stay on the party's own page.
export function QuickAddPartyDialog({ open, onOpenChange, role, onCreated }: QuickAddPartyProps) {
  const {
    register,
    control,
    setValue,
    trigger,
    getValues,
    reset,
    formState: { errors },
  } = useForm<PartyFormValues>({
    resolver: zodResolver(partySchema),
    defaultValues: toPartyValues(role),
  });
  const [roles, treatment, gstin, balanceSide] = useWatch({
    control,
    name: ["roles", "treatment", "gstin", "openingBalanceSide"],
  });
  const isCustomer = roles.includes("customer");
  const isVendor = roles.includes("vendor");
  const overseas = treatment === "overseas";
  const gstinCheck = gstin ? checkGstin(gstin) : undefined;
  const pickedFromGstin = needsGstin(treatment) && treatment !== "sez" && Boolean(gstinCheck?.valid);

  const toggleRole = (toggled: PartyRole) =>
    setValue("roles", roles.includes(toggled) ? roles.filter((existing) => existing !== toggled) : [...roles, toggled], { shouldValidate: true });

  const onGstinChange = (value: string) => {
    const upper = value.toUpperCase();
    setValue("gstin", upper);
    if (checkGstin(upper).valid) {
      setValue("pan", gstinPan(upper));
      if (treatment !== "sez")
        setValue("placeOfSupply", gstinStateCode(upper), {
          shouldValidate: true,
        });
    }
  };

  const changeOpen = (next: boolean) => {
    if (!next) reset(toPartyValues(role));
    onOpenChange(next);
  };

  const save = async () => {
    const saved = await saveParty(undefined, getValues());
    await reloadParties();
    onCreated(saved);
    reset(toPartyValues(role));
  };

  const who: ReactNode = (
    <>
      <div className={`${fullWidth} flex flex-wrap items-center gap-2`}>
        <span className="text-xs font-medium text-muted">This party is a</span>
        <FilterGroup label="This party is a">
          <FilterChip selected={isCustomer} onClick={() => toggleRole("customer")}>
            Customer
          </FilterChip>
          <FilterChip selected={isVendor} onClick={() => toggleRole("vendor")}>
            Vendor
          </FilterChip>
        </FilterGroup>
        {errors.roles && <span className="text-xs font-semibold text-danger-strong">{errors.roles.message}</span>}
      </div>
      <div className={fullWidth}>
        <TextField
          label="Display name"
          placeholder="Shown on quotations and invoices"
          autoFocus
          error={errors.displayName?.message}
          {...register("displayName")}
        />
      </div>
      <Controller
        control={control}
        name="kind"
        render={({ field }) => (
          <SelectField
            label="Type"
            options={[
              { value: "business", label: "Business" },
              { value: "individual", label: "Individual" },
            ]}
            value={field.value}
            onValueChange={field.onChange}
          />
        )}
      />
      <TextField label="Contact person" error={errors.contactPerson?.message} {...register("contactPerson")} />
      <TextField label="Mobile / WhatsApp" type="tel" placeholder="+919635312988" error={errors.phone?.message} {...register("phone")} />
      <TextField label="Email" type="email" error={errors.email?.message} {...register("email")} />
    </>
  );

  const gst: ReactNode = (
    <>
      <Controller
        control={control}
        name="treatment"
        render={({ field }) => (
          <div className={`${fullWidth} flex flex-col gap-1`}>
            <SelectField
              label="GST treatment"
              options={GST_TREATMENTS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              value={field.value}
              onValueChange={field.onChange}
            />
            <p className="text-xs font-medium text-muted">{GST_TREATMENTS.find((option) => option.value === field.value)?.hint}</p>
          </div>
        )}
      />
      {needsGstin(treatment) && (
        <>
          <TextField
            label="GSTIN"
            placeholder="15 characters"
            maxLength={15}
            value={gstin}
            onChange={(event) => onGstinChange(event.target.value)}
            hint={gstinCheck?.valid ? `Valid · ${stateName(gstinStateCode(gstin))}` : undefined}
            error={errors.gstin?.message}
          />
          <TextField label="PAN" error={errors.pan?.message} {...register("pan")} />
        </>
      )}
      {overseas ? (
        <>
          <TextField label="Country" placeholder="Bhutan" error={errors.country?.message} {...register("country")} />
          <TextField label="Their tax ID" placeholder="Bhutan TPN or equivalent" error={errors.foreignTaxId?.message} {...register("foreignTaxId")} />
        </>
      ) : (
        <Controller
          control={control}
          name="placeOfSupply"
          render={({ field }) => (
            <div className="flex flex-col gap-1">
              <SelectField
                label={pickedFromGstin ? "Place of supply · from the GSTIN" : "Place of supply"}
                options={STATE_OPTIONS}
                value={field.value || undefined}
                onValueChange={field.onChange}
                disabled={pickedFromGstin}
              />
              {errors.placeOfSupply && <p className="text-xs font-semibold text-danger-strong">{errors.placeOfSupply.message}</p>}
            </div>
          )}
        />
      )}
      <TextField label="Street / area" error={errors.addressLine?.message} {...register("addressLine")} />
      <TextField label="City / town" error={errors.city?.message} {...register("city")} />
      {!overseas && <TextField label="PIN code" inputMode="numeric" error={errors.pin?.message} {...register("pin")} />}
    </>
  );

  const balanceLabel = isCustomer && isVendor ? "Opening balance (₹)" : isCustomer ? "Opening balance they owe (₹)" : "Opening balance we owe (₹)";
  const terms: ReactNode = (
    <>
      <TextField
        label="Credit days"
        inputMode="numeric"
        hint={isVendor && !isCustomer ? "Days they give us" : "0 for cash"}
        error={errors.creditDays?.message}
        {...register("creditDays")}
      />
      <TextField label="Credit limit (₹)" inputMode="decimal" hint="Blank: no limit" error={errors.creditLimit?.message} {...register("creditLimit")} />
      <TextField label={balanceLabel} inputMode="decimal" error={errors.openingBalance?.message} {...register("openingBalance")} />
      {isCustomer && isVendor && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">The opening balance is</span>
          <FilterGroup label="The opening balance is">
            <FilterChip selected={balanceSide === "receivable"} onClick={() => setValue("openingBalanceSide", "receivable")}>
              They owe us
            </FilterChip>
            <FilterChip selected={balanceSide === "payable"} onClick={() => setValue("openingBalanceSide", "payable")}>
              We owe them
            </FilterChip>
          </FilterGroup>
        </div>
      )}
      {isVendor && !needsGstin(treatment) && !overseas && (
        <TextField label="TRANSIN (transporter ID)" hint="Only for a transporter without a GSTIN" error={errors.transin?.message} {...register("transin")} />
      )}
      <p className={`${fullWidth} text-xs font-medium text-muted`}>
        Branches, contacts, licences and bank details can be added later on the party&rsquo;s page.
      </p>
    </>
  );

  return (
    <StepDialog
      open={open}
      onOpenChange={changeOpen}
      title={role === "customer" ? "New customer" : "New vendor"}
      description="Saved to the party list and picked here."
      steps={[
        { title: "Who they are", content: who },
        { title: "GST & address", content: gst },
        { title: "Terms", content: terms },
      ]}
      validateStep={(index) => trigger(STEP_FIELDS[index])}
      onSave={save}
      saveLabel={role === "customer" ? "Save customer" : "Save vendor"}
    />
  );
}

/**
 * A party picker's "+": its dialog, and the function that opens it. The new
 * party goes to `onPick` once `listedIds` (the picker's own list) holds it.
 */
export function useQuickAddParty(role: PartyRole, listedIds: readonly string[], onPick: (id: string) => void) {
  const [open, setOpen] = useState(false);
  const pickLater = usePickWhenListed<null>(listedIds, (id) => onPick(id));
  return {
    open: () => setOpen(true),
    dialog: <QuickAddPartyDialog open={open} onOpenChange={setOpen} role={role} onCreated={(party) => pickLater(party.id, null)} />,
  };
}
