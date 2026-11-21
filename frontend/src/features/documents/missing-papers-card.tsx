import Link from "next/link";
import { CardTitle, GlassCard } from "@/components/ui/glass-card";
import type { MissingPaperView } from "@/types/document-register";
import { documentName } from "./documents-api";

/** Missing papers grouped by invoice, oldest first (the server sends them by date). */
function byInvoice(missing: MissingPaperView[]) {
  const groups = new Map<string, MissingPaperView[]>();
  for (const paper of missing) groups.set(paper.invoice.id, [...(groups.get(paper.invoice.id) ?? []), paper]);
  return [...groups.values()];
}

// Required papers not yet attached on issued invoices: the IRN on a B2B
// invoice, the e-way bill above ₹50,000. Each is attached on its invoice's page.
export function MissingPapersCard({ missing }: { missing: MissingPaperView[] }) {
  return (
    <GlassCard className="flex flex-col gap-3 xl:sticky xl:top-3.5">
      <CardTitle>Still to attach</CardTitle>
      {missing.length === 0 ? (
        <p className="text-sm font-semibold text-success-strong">Every issued invoice has its required papers.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {byInvoice(missing).map((papers) => {
            const { invoice, partyName } = papers[0];
            return (
              <li key={invoice.id} className="glass-inset flex flex-col gap-1.5 rounded-(--radius-tile) px-4 py-3">
                <span className="text-xs font-semibold text-muted">
                  <Link href={`/invoices/${invoice.id}`} className="text-sm font-semibold text-brand hover:underline">
                    {invoice.number}
                  </Link>{" "}
                  · {partyName}
                </span>
                <ul className="flex flex-col gap-1">
                  {papers.map((paper) => (
                    <li key={paper.kind} className="text-[13px] font-semibold">
                      {documentName(paper.kind)}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </GlassCard>
  );
}
