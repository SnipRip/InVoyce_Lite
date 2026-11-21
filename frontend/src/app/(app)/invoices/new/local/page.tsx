import type { Metadata } from "next";
import { Suspense } from "react";
import { NewInvoiceScreen } from "@/features/invoices/invoice-screens";

export const metadata: Metadata = { title: "New local invoice" };

type SearchParams = PageProps<"/invoices/new/local">["searchParams"];

// `?quotation=<id>` starts the invoice from that quotation (Convert to
// invoice); `?challan=<id>` bills that delivery challan. `searchParams` is request data, so it is read inside Suspense.
export default function NewLocalInvoicePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense>
      <Form searchParams={searchParams} />
    </Suspense>
  );
}

async function Form({ searchParams }: { searchParams: SearchParams }) {
  const { quotation, challan } = await searchParams;
  return <NewInvoiceScreen kind="local" quotationId={typeof quotation === "string" ? quotation : undefined} challanId={typeof challan === "string" ? challan : undefined} />;
}
