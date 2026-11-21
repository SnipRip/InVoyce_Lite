import type { Metadata } from "next";
import { Suspense } from "react";
import { FinancialStatementsScreen } from "@/features/books/financial-statements-screen";

export const metadata: Metadata = { title: "Financial statements" };

// Suspense: the screen reads ?view= and ?ledger= from the address.
export default function FinancialStatementsPage() {
  return (
    <Suspense>
      <FinancialStatementsScreen />
    </Suspense>
  );
}
