import type { Metadata } from "next";
import { Suspense } from "react";
import { REPORTS } from "@/features/reports/report-definitions";
import { ReportListNav } from "@/features/reports/report-list-nav";
import { ItemSummaryWorkspace } from "@/features/reports/item-summary/item-summary-workspace";

export const metadata: Metadata = { title: "Item summary" };

// The item sits in ?item=, read in the browser, so the workspace is inside Suspense.
export default function ItemSummaryPage() {
  return (
    <div className="flex flex-wrap items-start gap-3.5">
      <div className="flex-[1_1_200px] lg:max-w-[230px] print:hidden">
        <ReportListNav reports={REPORTS} activeId="item-summary" />
      </div>
      <div className="min-w-0 flex-[999_1_560px]">
        <Suspense>
          <ItemSummaryWorkspace />
        </Suspense>
      </div>
    </div>
  );
}
