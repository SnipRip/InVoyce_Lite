import type { Metadata } from "next";
import { ChallansListScreen } from "@/features/challans/challan-screens";

export const metadata: Metadata = { title: "Delivery challans" };

export default function DeliveryChallansPage() {
  return <ChallansListScreen />;
}
