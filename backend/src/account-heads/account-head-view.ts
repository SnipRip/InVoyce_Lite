import { toNumber } from '../common/decimal.js';
import type { StandardGroupName } from '../common/accounts/standard-groups.js';
import type { AccountHead } from '../generated/prisma/client.js';
import { HEAD_GROUPS } from './account-head-rules.js';

/** A head as the API returns it: rate as a number, with its ledger group. */
export interface AccountHeadView {
  id: string;
  /** The ledger name. */
  name: string;
  nature: AccountHead['nature'];
  /** The ledger group the ledger goes under, from the nature. */
  accountGroup: StandardGroupName;
  /** Expense heads only. */
  gst: AccountHead['gst'];
  /** OWN_RATE only. */
  gstRatePct: number | null;
  /** Expense heads only. */
  allocation: AccountHead['allocation'];
  notes: string | null;
  isArchived: boolean;
}

export const toAccountHeadView = (head: AccountHead): AccountHeadView => ({
  id: head.id,
  name: head.name,
  nature: head.nature,
  accountGroup: HEAD_GROUPS[head.nature],
  gst: head.gst,
  gstRatePct: toNumber(head.gstRatePct),
  allocation: head.allocation,
  notes: head.notes,
  isArchived: head.isArchived,
});
