"use client";

import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { Button, buttonClasses } from "@/components/ui/button";
import { ComboField } from "@/components/ui/combo-field";
import { FormMessage } from "@/components/ui/form-message";
import { CardTitle } from "@/components/ui/glass-card";
import { VoucherSteps } from "@/components/ui/voucher-steps";
import { GODOWN_BLANK, GODOWN_FIELDS } from "@/features/masters/godowns-master";
import { GODOWNS_PATH, godownPersistence } from "@/features/masters/masters-api";
import { useQuickAddRecord } from "@/features/masters/quick-add-record";
import { SelectField } from "@/components/ui/select-field";
import { StatusChip } from "@/components/ui/status-chip";
import { NextNumberChip } from "@/features/number-series/next-number-chip";
import { TextField } from "@/components/ui/text-field";
import { itemLabel, type ItemCatalog } from "@/features/items/item-rules";
import { stockIn } from "@/features/items/item-stock";
import { useQuickAddItem } from "@/features/items/quick-add-item";
import type { Party } from "@/features/parties/types";
import { useQuickAddParty } from "@/features/parties/quick-add-party";
import { ApiError, apiGet } from "@/lib/api-client";
import { formatQuantity, formatRate } from "@/lib/format";
import { useToday } from "@/lib/use-today";
import type { ChallanView } from "@/types/challan";
import { challanPreviewPath, createChallan, heldOnChallans } from "./challans-api";

interface ChallanLine {
  key: number;
  itemId: string;
  quantity: string;
  rate: string;
}

interface ChallanFormProps {
  customers: Party[];
  catalog: ItemCatalog;
  godowns: { id: string; name: string }[];
  challans: ChallanView[];
  /** Dispatching a quotation: its customer and lines (base units, rate after discount). */
  fromQuotation?: { id: string; label: string; partyId: string; lines: { itemId: string; quantity: number; rate: number }[] };
  onSaved: () => Promise<void>;
}

let nextKey = 1;
const blankLine = (): ChallanLine => ({ key: nextKey++, itemId: "", quantity: "", rate: "" });

// A delivery challan (client, 12 Nov 2026): the customer, the godown the goods
// leave, and what goes, often straight from a quotation. Each line shows what
// is free to send (in the godown less what open challans hold). Nothing posts
// to the books; the invoice raised from it later bills the goods.
export function ChallanForm({ customers, catalog, godowns, challans, fromQuotation, onSaved }: ChallanFormProps) {
  const today = useToday();
  const router = useRouter();
  const [partyId, setPartyId] = useState(fromQuotation?.partyId ?? "");
  const [godownId, setGodownId] = useState(godowns[0]?.id ?? "");
  const [picked, setPicked] = useState("");
  const [number, setNumber] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [shipTo, setShipTo] = useState("");
  const [shipCity, setShipCity] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<ChallanLine[]>(
    fromQuotation?.lines.map((line) => ({ key: nextKey++, itemId: line.itemId, quantity: String(line.quantity), rate: String(Math.round(line.rate * 100) / 100) })) ?? [blankLine()],
  );
  const [result, setResult] = useState<{ text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  /** The step a failed save points at; its message shows there. */
  const [failedStep, setFailedStep] = useState<number | null>(null);
  const date = picked || today || "";
  const { data: next } = useSWR<{ number: string | null; method: string }>(date ? challanPreviewPath(date) : null, apiGet);
  const numberTyped = next !== undefined && next.method !== "AUTOMATIC";

  const live = customers.filter((party) => !party.archived);
  const addCustomer = useQuickAddParty("customer", live.map((party) => party.id), setPartyId);
  const addItem = useQuickAddItem<number>(catalog.items.map((item) => item.id), (itemId, key) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, itemId } : line))),
  );
  const addGodown = useQuickAddRecord({ title: "New godown", fields: GODOWN_FIELDS, blank: GODOWN_BLANK, persistence: godownPersistence(() => {}), path: GODOWNS_PATH, listedIds: godowns.map((godown) => godown.id), onPick: setGodownId });
  const held = heldOnChallans(challans, godownId);
  const update = (key: number, change: Partial<ChallanLine>) => setLines((current) => current.map((line) => (line.key === key ? { ...line, ...change } : line)));
  const value = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.rate) || 0), 0);

  const save = async () => {
    setResult(null);
    const filled = lines.filter((line) => line.itemId);
    const fail = (at: number, text: string) => {
      setFailedStep(at);
      setStep(at);
      setResult({ text });
    };
    if (!partyId) return fail(0, "Pick the customer");
    if (!godownId) return fail(0, "Pick the godown the goods leave from");
    if (!filled.length) return fail(1, "Add at least one item");
    if (filled.some((line) => !(Number(line.quantity) > 0))) return fail(1, "Every line needs a quantity above zero");
    setFailedStep(null);
    setBusy(true);
    try {
      const saved = await createChallan({
        date,
        number: number.trim() || null,
        partyId,
        godownId,
        quotationId: fromQuotation?.id ?? null,
        shipToLine: shipTo.trim() || null,
        shipToCity: shipCity.trim() || null,
        vehicleNumber: vehicle.trim() || null,
        notes: notes.trim() || null,
        lines: filled.map((line) => ({ itemId: line.itemId, quantity: Number(line.quantity), ...(line.rate ? { rate: Number(line.rate) } : {}) })),
      });
      await onSaved();
      router.push(`/delivery-challans/${saved.id}`);
    } catch (error) {
      setFailedStep(2);
      setResult({ text: error instanceof ApiError ? error.message : "Could not save. Check the connection and try again." });
    } finally {
      setBusy(false);
    }
  };

  // Three steps that each fit the screen, worked like a voucher (client, 13 Nov 2026).
  return (
    <form
      noValidate
      className="max-w-[1180px]"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      {addCustomer.dialog}
      {addItem.dialog}
      {addGodown.dialog}
      <VoucherSteps
        heading={
          <>
            <CardTitle>New delivery challan</CardTitle>
            <NextNumberChip next={next} />
            {fromQuotation && <StatusChip tone="brand">From {fromQuotation.label}</StatusChip>}
          </>
        }
        step={step}
        onStepChange={setStep}
        onAccept={() => void save()}
        steps={[
          {
            id: "customer",
            title: "Customer",
            summary: live.find((party) => party.id === partyId)?.displayName,
            invalid: failedStep === 0,
            content: (
              <>
                <div className="grid items-start gap-3.5 @xl:grid-cols-[minmax(0,2fr)_1fr_160px_160px]">
                  <ComboField
                    label="Customer"
                    options={live.map((party) => ({ value: party.id, label: party.displayName, detail: party.gstin ?? undefined }))}
                    value={partyId}
                    onChange={setPartyId}
                    disabled={Boolean(fromQuotation)}
                    onAdd={addCustomer.open}
                    addLabel="Add a new customer"
                    placeholder="Type a customer name"
                  />
                  <SelectField label="Goods leave from" options={godowns.map((godown) => ({ value: godown.id, label: godown.name }))} value={godownId || undefined} onValueChange={setGodownId} onAdd={addGodown.open} addLabel="Add a new godown" />
                  <TextField label="Date" type="date" value={date} max={today ?? undefined} onChange={(event) => setPicked(event.target.value)} />
                  <TextField
                    label="Number"
                    disabled={!numberTyped}
                    value={number}
                    placeholder={next?.number ?? ""}
                    hint={numberTyped ? "Type it, or blank for the next" : "Given on save"}
                    onChange={(event) => setNumber(event.target.value)}
                  />
                </div>
                {failedStep === 0 && result && <FormMessage tone="error" result={result}>{result.text}</FormMessage>}
              </>
            ),
          },
          {
            id: "goods",
            title: "Goods",
            summary: `Value ${formatRate(value)}`,
            invalid: failedStep === 1,
            content: (
              <>
                <div className="hidden grid-cols-[minmax(0,1fr)_120px_130px_150px_40px] gap-2.5 text-xs font-medium text-muted @2xl:grid">
                  <span>Item</span>
                  <span className="text-right">Quantity</span>
                  <span className="text-right">Rate ₹ (value only)</span>
                  <span className="text-right">Free to send</span>
                  <span />
                </div>
                {lines.map((line) => {
                  const item = catalog.items.find((candidate) => candidate.id === line.itemId);
                  const free = item ? Math.round((stockIn(item, godownId) - (held.get(item.id) ?? 0)) * 1000) / 1000 : null;
                  const short = free !== null && Number(line.quantity) > free;
                  return (
                    <div key={line.key} className="grid items-start gap-2.5 @2xl:grid-cols-[minmax(0,1fr)_120px_130px_150px_40px]">
                      <ComboField
                        label="Item"
                        hideLabel
                        options={catalog.items.map((candidate) => ({ value: candidate.id, label: itemLabel(candidate) }))}
                        value={line.itemId}
                        onChange={(itemId) => update(line.key, { itemId })}
                        onAdd={() => addItem.open(line.key)}
                        addLabel="Add a new item"
                        placeholder="Type an item name or SKU"
                      />
                      <TextField label="Quantity" hideLabel inputMode="decimal" className="text-right" value={line.quantity} onChange={(event) => update(line.key, { quantity: event.target.value })} error={short ? "More than is free" : undefined} />
                      <TextField label="Rate" hideLabel inputMode="decimal" className="text-right" placeholder="Optional" value={line.rate} onChange={(event) => update(line.key, { rate: event.target.value })} />
                      <span className={`flex h-[34px] items-center justify-end text-[13px] font-semibold tabular-nums ${short ? "text-danger-strong" : "text-muted"}`}>
                        {free === null ? "" : `${formatQuantity(free)} ${item?.overrides.unit ?? ""}`}
                      </span>
                      <Button variant="neutral" aria-label="Remove this line" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((candidate) => candidate.key !== line.key))} className="w-10 px-0">
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                  );
                })}
                <div className="flex flex-wrap items-center gap-2.5">
                  <Button variant="outline" onClick={() => setLines((current) => [...current, blankLine()])}>
                    <Plus aria-hidden="true" />
                    Add an item
                  </Button>
                  <span className="ml-auto text-sm font-semibold tabular-nums">Value {formatRate(value)}</span>
                </div>
                <p className="text-xs font-medium text-muted">
                  A challan is not a sale: nothing posts to the books and the goods stay in stock at cost until the invoice raised from it. Open challans hold their goods back,
                  so they are not billed twice.
                </p>
                {failedStep === 1 && result && <FormMessage tone="error" result={result}>{result.text}</FormMessage>}
              </>
            ),
          },
          {
            id: "delivery",
            title: "Delivery",
            content: (
              <>
                <div className="grid gap-3.5 @xl:grid-cols-3">
                  <TextField label="Vehicle number" placeholder="WB73E1234" value={vehicle} onChange={(event) => setVehicle(event.target.value)} />
                  <TextField label="Deliver to" placeholder="Site address, if not the billing address" value={shipTo} onChange={(event) => setShipTo(event.target.value)} />
                  <TextField label="City / town" value={shipCity} onChange={(event) => setShipCity(event.target.value)} />
                </div>
                <TextField label="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
                {failedStep === 2 && result && <FormMessage tone="error" result={result}>{result.text}</FormMessage>}
              </>
            ),
          },
        ]}
        actions={
          <>
            <Link href="/delivery-challans" className={buttonClasses("neutral")} tabIndex={-1}>
              Cancel
            </Link>
            <Button type="submit" disabled={busy} data-voucher-accept="">
              {busy ? "Saving…" : "Save the challan"}
            </Button>
          </>
        }
      />
    </form>
  );
}
