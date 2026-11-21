import { isoDate } from '../common/dates.js';
import { toNumber } from '../common/decimal.js';
import type { BankCashAccount } from '../generated/prisma/client.js';
import type { StandardGroupName } from '../common/accounts/standard-groups.js';
import { BANK_CASH_GROUPS } from './bank-cash-rules.js';

/** An account as the API returns it: date as YYYY-MM-DD, balance as a number. */
export interface BankCashAccountView {
  id: string;
  name: string;
  kind: BankCashAccount['kind'];
  bankName: string | null;
  branch: string | null;
  accountNumber: string | null;
  ifsc: string | null;
  upiId: string | null;
  openingBalance: number;
  openingDate: string;
  showOnInvoice: boolean;
  /** The bank account receipts and payments start on. */
  isDefault: boolean;
  /** Null: the ledger carries the account name. */
  ledgerName: string | null;
  /** The ledger group the ledger goes under. */
  accountGroup: StandardGroupName;
  isArchived: boolean;
}

export const toBankCashAccountView = (account: BankCashAccount): BankCashAccountView => ({
  id: account.id,
  name: account.name,
  kind: account.kind,
  bankName: account.bankName,
  branch: account.branch,
  accountNumber: account.accountNumber,
  ifsc: account.ifsc,
  upiId: account.upiId,
  openingBalance: toNumber(account.openingBalance),
  openingDate: isoDate(account.openingDate),
  showOnInvoice: account.showOnInvoice,
  isDefault: account.isDefault,
  ledgerName: account.ledgerName,
  accountGroup: BANK_CASH_GROUPS[account.kind],
  isArchived: account.isArchived,
});
