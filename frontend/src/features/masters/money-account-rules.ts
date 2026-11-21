// Which bank or cash account a receipt, payment, refund or expense starts on:
// cash goes to the one cash account; any other mode to the default bank
// account, else the first live bank account (client, 12 Nov 2026).
import type { BankCashAccountView } from "@/types/bank-cash";

/** `mode` is the payment mode as the forms hold it: "CASH", "UPI", "NEFT"… */
export function defaultAccountFor(liveAccounts: BankCashAccountView[], mode: string): string {
  const cash = mode === "CASH";
  const fits = liveAccounts.filter((account) => (account.kind === "CASH") === cash);
  return (fits.find((account) => account.isDefault) ?? fits[0])?.id ?? "";
}
