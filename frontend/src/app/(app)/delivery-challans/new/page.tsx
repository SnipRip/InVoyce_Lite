import type { Metadata } from "next";
import { Suspense } from "react";
import { NewChallanScreen } from "@/features/challans/challan-screens";

export const metadata: Metadata = { title: "New delivery challan" };

// Suspense: the form reads ?quotation= from the address.
export default function NewDeliveryChallanPage() {
  return (
    <Suspense>
      <NewChallanScreen />
    </Suspense>
  );
}
