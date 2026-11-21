import type { Metadata } from "next";
import { Suspense } from "react";
import { ChallanScreen } from "@/features/challans/challan-screens";

export const metadata: Metadata = { title: "Delivery challan" };

type ChallanParams = PageProps<"/delivery-challans/[challanId]">["params"];

// `params` is request data, so it is read inside a Suspense boundary.
export default function DeliveryChallanPage({ params }: { params: ChallanParams }) {
  return (
    <Suspense>
      <Challan params={params} />
    </Suspense>
  );
}

async function Challan({ params }: { params: ChallanParams }) {
  return <ChallanScreen challanId={(await params).challanId} />;
}
