"use client";

import { FormMessage } from "@/components/ui/form-message";
import { CardTitle, GlassCard } from "@/components/ui/glass-card";
import { SwitchField } from "@/components/ui/switch-field";
import { useCurrentUser } from "@/features/auth/current-user-context";
import { saveSalesSettings, useSalesSettings } from "@/features/sales-settings/sales-settings-api";
import { useFormResult } from "./use-form-result";

// Company-wide sales behaviour. Everyone sees how it is set; only an
// administrator can change it (the backend refuses anyone else).
export function SalesSettingsCard() {
  const user = useCurrentUser();
  const isAdmin = user.role === "ADMIN";
  const { settings, error, mutate } = useSalesSettings();
  const { result, run } = useFormResult();

  async function toggle(invoiceInStockOnly: boolean) {
    await run(async () => mutate(await saveSalesSettings({ invoiceInStockOnly }), { revalidate: false }), "Sales settings saved");
  }

  return (
    <GlassCard aria-labelledby="settings-sales" className="flex flex-col gap-3.5">
      <CardTitle id="settings-sales">Sales</CardTitle>
      {error && <FormMessage tone="error">Sales settings could not be loaded.</FormMessage>}
      {settings && (
        <SwitchField
          id="invoice-in-stock-only"
          label="Invoice: show only items in stock"
          description={
            <>
              The item list on a new invoice shows only items that have stock in the chosen godown. When off, every item is listed, and issuing still refuses more than the godown holds.
              {!isAdmin && " Only an administrator can change this."}
            </>
          }
          checked={settings.invoiceInStockOnly}
          disabled={!isAdmin}
          onCheckedChange={toggle}
        />
      )}
      {result && <FormMessage tone={result.tone} result={result}>{result.text}</FormMessage>}
    </GlassCard>
  );
}
