"use client";

import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { LoadNotice } from "@/components/ui/load-notice";
import { useItemMasters } from "@/features/items/catalog-api";
import { PARTIES_PATH, toParty } from "@/features/parties/parties-api";
import { useCompanyProfile } from "@/features/company/use-company-profile";
import { issuerOf, QUOTATIONS_PATH } from "@/features/quotations/quotations-api";
import { apiGet } from "@/lib/api-client";
import type { ChallanView } from "@/types/challan";
import type { PartyView } from "@/types/party";
import type { QuotationView } from "@/types/quotation";
import { ChallanDetail } from "./challan-detail";
import { ChallanForm } from "./challan-form";
import { CHALLANS_PATH } from "./challans-api";
import { ChallansWorkspace } from "./challans-workspace";

// The delivery challan pages' client screens, from the backend.
const CUSTOMERS_PATH = `${PARTIES_PATH}?role=customer&includeArchived=true`;
const useChallans = () => useSWR<ChallanView[]>(CHALLANS_PATH, apiGet);

export function ChallansListScreen() {
  const { data, error } = useChallans();
  if (!data) return <LoadNotice error={error} what="delivery challans" />;
  return <ChallansWorkspace challans={data} />;
}

export function NewChallanScreen() {
  const params = useSearchParams();
  const quotationId = params.get("quotation");
  const challans = useChallans();
  const customers = useSWR<PartyView[]>(CUSTOMERS_PATH, apiGet);
  const quotation = useSWR<QuotationView>(quotationId ? `${QUOTATIONS_PATH}/${quotationId}` : null, apiGet);
  const { masters, error: mastersError, reload } = useItemMasters();
  const error = challans.error ?? customers.error ?? mastersError ?? quotation.error;
  if (!challans.data || !customers.data || !masters || (quotationId && !quotation.data && !quotation.error)) return <LoadNotice error={error} what="the challan form" />;
  const from = quotation.data;
  return (
    <ChallanForm
      customers={customers.data.map(toParty)}
      catalog={masters.catalog}
      godowns={masters.godowns.filter((godown) => !godown.isArchived)}
      challans={challans.data}
      fromQuotation={
        from && {
          id: from.id,
          label: from.revision ? `${from.number}-R${from.revision}` : from.number,
          partyId: from.partyId,
          // Base units, at the quoted rate after its discount.
          lines: from.lines.map((line) => ({ itemId: line.itemId, quantity: line.quantity, rate: line.rate * (1 - line.discountPct / 100) })),
        }
      }
      onSaved={async () => {
        await Promise.all([challans.mutate(), reload()]);
      }}
    />
  );
}

export function ChallanScreen({ challanId }: { challanId: string }) {
  const { data, error, mutate } = useChallans();
  const customers = useSWR<PartyView[]>(CUSTOMERS_PATH, apiGet);
  const { profile, error: profileError } = useCompanyProfile();
  if (!data || !customers.data || !profile) return <LoadNotice error={error ?? customers.error ?? profileError} what="the challan" />;
  const challan = data.find((candidate) => candidate.id === challanId);
  if (!challan) return <LoadNotice error={new Error("This challan does not exist.")} what="the challan" />;
  const party = customers.data.find((candidate) => candidate.id === challan.partyId);
  return (
    <ChallanDetail
      challan={challan}
      party={party ? toParty(party) : undefined}
      issuer={issuerOf(profile)}
      overseas={party?.treatment === "OVERSEAS" || party?.treatment === "SEZ"}
      onChanged={async () => {
        await mutate();
      }}
    />
  );
}
