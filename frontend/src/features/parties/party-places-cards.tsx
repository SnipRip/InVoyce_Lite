"use client";

// The party form's branches, contacts and licences. One party is one name
// and one ledger; its own GST and address fields are the main branch, these
// cards hold the rest (a multi-address ledger).
import { Plus, Trash2 } from "lucide-react";
import { Controller, useFieldArray, useWatch, type Control, type FieldErrors, type UseFormRegister, type UseFormSetValue } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/filter-chip";
import { FilterGroup } from "@/components/ui/filter-group";
import { CardTitle } from "@/components/ui/glass-card";
import { IconAction } from "@/components/ui/icon-action";
import { SelectField } from "@/components/ui/select-field";
import { TextField } from "@/components/ui/text-field";
import { GST_TREATMENTS, needsGstin } from "@/features/gst/gst-rules";
import { checkGstin, gstinStateCode } from "@/features/gst/gstin";
import { INDIAN_STATES, stateName } from "@/features/gst/indian-states";
import type { LicenceKind } from "@/types/party";
import { MAIN_BRANCH } from "./party-branches";
import type { BranchFormValues, PartyFormValues } from "./party-schema";

interface CardProps {
  control: Control<PartyFormValues>;
  register: UseFormRegister<PartyFormValues>;
  setValue: UseFormSetValue<PartyFormValues>;
  errors: FieldErrors<PartyFormValues>;
}

const STATE_OPTIONS = INDIAN_STATES.map((state) => ({ value: state.code, label: `${state.name} (${state.code})` }));
const BRANCH_TREATMENTS = GST_TREATMENTS.filter((option) => option.value !== "overseas");

export const LICENCE_KINDS: { value: LicenceKind; label: string; hint: string }[] = [
  { value: "FSSAI", label: "FSSAI (food)", hint: "14 digits" },
  { value: "DRUG", label: "Drug licence", hint: "Form 20 / 21" },
  { value: "TRADE", label: "Trade licence", hint: "Municipal" },
  { value: "SHOP_ESTABLISHMENT", label: "Shop & establishment", hint: "" },
  { value: "IEC", label: "Import export code", hint: "10 characters" },
  { value: "OTHER", label: "Other", hint: "" },
];

let newKey = 0;
const freshKey = () => `new-${Date.now().toString(36)}-${(newKey += 1)}`;

export function emptyBranch(kind: BranchFormValues["kind"], stateCode = ""): BranchFormValues {
  return { key: freshKey(), stored: false, kind, name: "", treatment: "registered", gstin: "", stateCode, line1: "", city: "", pin: "", archived: false };
}

/** "Main · Patna" and each live branch, for the contact / licence "at" picker. */
function placeOptions(mainCity: string, branches: BranchFormValues[]) {
  return [
    { value: MAIN_BRANCH, label: mainCity ? `Main · ${mainCity}` : "Main branch" },
    ...branches.filter((branch) => !branch.archived).map((branch) => ({ value: branch.key, label: branch.name || "Unnamed branch" })),
  ];
}

export function BranchesCard({ control, register, setValue, errors }: CardProps) {
  const { fields, append, remove } = useFieldArray({ control, name: "branches", keyName: "fieldKey" });
  const [branches, mainState] = useWatch({ control, name: ["branches", "placeOfSupply"] });

  const onGstinChange = (index: number, value: string) => {
    const upper = value.toUpperCase();
    setValue(`branches.${index}.gstin`, upper, { shouldDirty: true });
    if (checkGstin(upper).valid && branches[index]?.treatment !== "sez") {
      setValue(`branches.${index}.stateCode`, gstinStateCode(upper), { shouldDirty: true, shouldValidate: true });
    }
  };

  return (
    <section className="flex flex-col gap-3.5 border-t border-line pt-3.5 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Branches and delivery addresses</CardTitle>
        <div className="flex gap-2">
          <Button variant="neutral" onClick={() => append(emptyBranch("branch"))}>
            <Plus className="size-4" aria-hidden /> Branch
          </Button>
          <Button variant="neutral" onClick={() => append(emptyBranch("ship-to", mainState))}>
            <Plus className="size-4" aria-hidden /> Delivery address
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted">
        The GST and address above are the main branch. Add a <b>branch</b> for each other place they bill from or are billed at (its own GSTIN in
        another state, or the same GSTIN at another place in the same state). A <b>delivery address</b> is only where goods go; GST follows
        whoever is billed. Everything stays under one name for reports and the ledger.
      </p>
      {fields.length === 0 && <p className="text-sm text-muted">One place of business only.</p>}
      {fields.map((field, index) => {
        const branch = branches[index] ?? field;
        const own = branch.kind === "branch";
        const rowErrors = errors.branches?.[index];
        const gstinCheck = branch.gstin ? checkGstin(branch.gstin) : undefined;
        const lockedState = own && needsGstin(branch.treatment) && branch.treatment !== "sez" && Boolean(gstinCheck?.valid);
        return (
          <div key={field.fieldKey} className={`flex flex-col gap-3 rounded-2xl border border-line p-3.5 ${branch.archived ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-[11.5px] font-semibold text-ink-soft">
                {own ? "Branch" : "Delivery address"}
                {branch.stored && branch.archived ? " · archived" : ""}
              </span>
              <div className="ml-auto flex gap-2">
                {branch.stored && (
                  <Button variant="neutral" onClick={() => setValue(`branches.${index}.archived`, !branch.archived, { shouldDirty: true })}>
                    {branch.archived ? "Restore" : "Archive"}
                  </Button>
                )}
                <IconAction label={branch.stored ? "Remove (archived instead if already on a bill or invoice)" : "Remove"} danger onClick={() => remove(index)}>
                  <Trash2 className="size-4" aria-hidden />
                </IconAction>
              </div>
            </div>
            <div className="grid gap-x-3.5 gap-y-3 @xl:grid-cols-2 @4xl:grid-cols-3">
              <TextField label="Name" placeholder={own ? "Ranchi branch" : "Site at Hasimara"} error={rowErrors?.name?.message} {...register(`branches.${index}.name`)} />
              {own && (
                <Controller
                  control={control}
                  name={`branches.${index}.treatment`}
                  render={({ field: treatment }) => (
                    <SelectField
                      label="GST treatment"
                      options={BRANCH_TREATMENTS.map((option) => ({ value: option.value, label: option.label }))}
                      value={treatment.value}
                      onValueChange={treatment.onChange}
                    />
                  )}
                />
              )}
              {own && needsGstin(branch.treatment) && (
                <TextField
                  label="GSTIN"
                  placeholder="15 characters"
                  maxLength={15}
                  value={branch.gstin}
                  onChange={(event) => onGstinChange(index, event.target.value)}
                  hint={gstinCheck?.valid ? `Valid · ${stateName(gstinStateCode(branch.gstin))}` : undefined}
                  error={rowErrors?.gstin?.message}
                />
              )}
              <Controller
                control={control}
                name={`branches.${index}.stateCode`}
                render={({ field: state }) => (
                  <div className="flex flex-col gap-1.5">
                    <SelectField
                      label={lockedState ? "State · from the GSTIN" : "State"}
                      options={STATE_OPTIONS}
                      value={state.value || undefined}
                      onValueChange={state.onChange}
                      disabled={lockedState}
                    />
                    {rowErrors?.stateCode && <p className="text-xs font-semibold text-danger-strong">{rowErrors.stateCode.message}</p>}
                  </div>
                )}
              />
              <TextField label="Street / area" error={rowErrors?.line1?.message} {...register(`branches.${index}.line1`)} />
              <TextField label="City / town" error={rowErrors?.city?.message} {...register(`branches.${index}.city`)} />
              <TextField label="PIN code" inputMode="numeric" error={rowErrors?.pin?.message} {...register(`branches.${index}.pin`)} />
            </div>
          </div>
        );
      })}
    </section>
  );
}

export function ContactsCard({ control, register, errors }: CardProps) {
  const { fields, append, remove } = useFieldArray({ control, name: "contacts", keyName: "fieldKey" });
  const [branches, mainCity, contacts] = useWatch({ control, name: ["branches", "city", "contacts"] });
  const places = placeOptions(mainCity, branches);

  return (
    <section className="flex flex-col gap-3.5 border-t border-line pt-3.5 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>More contacts</CardTitle>
        <Button variant="neutral" onClick={() => append({ branch: MAIN_BRANCH, name: "", designation: "", phone: "", email: "", whatsapp: false })}>
          <Plus className="size-4" aria-hidden /> Contact
        </Button>
      </div>
      <p className="text-xs text-muted">The contact person above is the main one. Add the others, at the main branch or at a branch.</p>
      {fields.map((field, index) => {
        const rowErrors = errors.contacts?.[index];
        const contact = contacts[index] ?? field;
        return (
          <div key={field.fieldKey} className="grid items-end gap-x-3 gap-y-3 rounded-2xl border border-line p-3.5 @xl:grid-cols-2 @4xl:grid-cols-[1.2fr_1fr_1fr_1.2fr_1fr_auto]">
            <TextField label="Name" error={rowErrors?.name?.message} {...register(`contacts.${index}.name`)} />
            <TextField label="Designation" placeholder="Accounts, sales…" error={rowErrors?.designation?.message} {...register(`contacts.${index}.designation`)} />
            <TextField label="Mobile" type="tel" placeholder="+919635312988" error={rowErrors?.phone?.message} {...register(`contacts.${index}.phone`)} />
            <TextField label="Email" type="email" error={rowErrors?.email?.message} {...register(`contacts.${index}.email`)} />
            <Controller
              control={control}
              name={`contacts.${index}.branch`}
              render={({ field: at }) => <SelectField label="At" options={places} value={at.value} onValueChange={at.onChange} />}
            />
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name={`contacts.${index}.whatsapp`}
                render={({ field: whatsapp }) => (
                  <FilterGroup label="WhatsApp">
                    <FilterChip selected={whatsapp.value} onClick={() => whatsapp.onChange(!contact.whatsapp)}>
                      WhatsApp
                    </FilterChip>
                  </FilterGroup>
                )}
              />
              <IconAction label="Remove contact" danger onClick={() => remove(index)}>
                <Trash2 className="size-4" aria-hidden />
              </IconAction>
            </div>
          </div>
        );
      })}
    </section>
  );
}

export function LicencesCard({ control, register, errors }: CardProps) {
  const { fields, append, remove } = useFieldArray({ control, name: "licences", keyName: "fieldKey" });
  const [branches, mainCity, licences] = useWatch({ control, name: ["branches", "city", "licences"] });
  const places = placeOptions(mainCity, branches);

  return (
    <section className="flex flex-col gap-3.5 border-t border-line pt-3.5 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Licences</CardTitle>
        <Button variant="neutral" onClick={() => append({ branch: MAIN_BRANCH, kind: "FSSAI", label: "", number: "", validUntil: "" })}>
          <Plus className="size-4" aria-hidden /> Licence
        </Button>
      </div>
      <p className="text-xs text-muted">Optional. FSSAI, drug, trade or any licence you need on file for this party, with its expiry.</p>
      {fields.map((field, index) => {
        const rowErrors = errors.licences?.[index];
        const kind = licences[index]?.kind ?? field.kind;
        return (
          <div key={field.fieldKey} className="grid items-end gap-x-3 gap-y-3 rounded-2xl border border-line p-3.5 @xl:grid-cols-2 @4xl:grid-cols-[1.2fr_1fr_1.2fr_1fr_1fr_auto]">
            <Controller
              control={control}
              name={`licences.${index}.kind`}
              render={({ field: licenceKind }) => (
                <SelectField label="Licence" options={LICENCE_KINDS.map(({ value, label }) => ({ value, label }))} value={licenceKind.value} onValueChange={licenceKind.onChange} />
              )}
            />
            {kind === "OTHER" ? (
              <TextField label="Which licence" error={rowErrors?.label?.message} {...register(`licences.${index}.label`)} />
            ) : (
              <span className="hidden @4xl:block" />
            )}
            <TextField label="Number" hint={LICENCE_KINDS.find((option) => option.value === kind)?.hint || undefined} error={rowErrors?.number?.message} {...register(`licences.${index}.number`)} />
            <TextField label="Valid till" type="date" error={rowErrors?.validUntil?.message} {...register(`licences.${index}.validUntil`)} />
            <Controller
              control={control}
              name={`licences.${index}.branch`}
              render={({ field: at }) => <SelectField label="For" options={places} value={at.value} onValueChange={at.onChange} />}
            />
            <IconAction label="Remove licence" danger onClick={() => remove(index)}>
              <Trash2 className="size-4" aria-hidden />
            </IconAction>
          </div>
        );
      })}
    </section>
  );
}
