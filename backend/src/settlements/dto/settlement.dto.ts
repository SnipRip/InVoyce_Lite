import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsIn, IsOptional, IsString, IsUUID, Length, MaxLength, ValidateNested } from 'class-validator';
import { IsAmount, IsIsoDate } from '../../common/dto/field-validators.js';
import { codeOrNull, trim, trimToNull } from '../../common/dto/text-transforms.js';
import { PaymentMode, SettlementDirection } from '../../generated/prisma/enums.js';

/** Enough for a big customer clearing a year of invoices at once. */
export const MAX_ALLOCATIONS = 200;

// Field formats only; settlements.service.ts checks the party, the account,
// the balances.
export class AllocationDto {
  /**
   * INVOICE for receipts, BILL or EXPENSE (bought on credit) for payments,
   * OPENING for the party's opening balance; on a refund ADVANCE (the receipt
   * or payment whose advance it gives back), CREDIT_NOTE (a payment to the
   * customer of a credit note's credit) or DEBIT_NOTE (a receipt from the
   * vendor of a debit note's credit). JOURNAL: a journal line that charged
   * the party (documentId = the line).
   */
  @IsIn(['INVOICE', 'BILL', 'EXPENSE', 'OPENING', 'ADVANCE', 'CREDIT_NOTE', 'DEBIT_NOTE', 'JOURNAL'])
  kind: 'INVOICE' | 'BILL' | 'EXPENSE' | 'OPENING' | 'ADVANCE' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'JOURNAL';

  /** The invoice, bill, expense, advance's settlement or note; for OPENING the party's own id. */
  @IsUUID()
  documentId: string;

  @IsAmount()
  amount: number;
}

export class SettlementDto {
  @IsEnum(SettlementDirection)
  direction: SettlementDirection;

  @IsUUID()
  partyId: string;

  @IsIsoDate('Pick the date')
  date: string;

  @IsUUID()
  accountId: string;

  @IsEnum(PaymentMode)
  mode: PaymentMode;

  @IsAmount()
  amount: number;

  @IsOptional()
  @IsAmount()
  tds?: number;

  /** Typed only when the series allows it; blank takes the next number. */
  @Transform(codeOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(16)
  number?: string | null;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(60)
  reference?: string | null;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string | null;

  @IsArray()
  @ArrayMaxSize(MAX_ALLOCATIONS)
  @ValidateNested({ each: true })
  @Type(() => AllocationDto)
  allocations: AllocationDto[];
}

/** Applies what a settlement left as an advance to documents opened since. */
export class ApplyAdvanceDto {
  @IsArray()
  @ArrayMaxSize(MAX_ALLOCATIONS)
  @ValidateNested({ each: true })
  @Type(() => AllocationDto)
  allocations: AllocationDto[];
}

export class CancelSettlementDto {
  @Transform(trim)
  @IsString()
  @Length(2, 200)
  reason: string;
}

export class SettlementQueryDto {
  @IsOptional()
  @IsEnum(SettlementDirection)
  direction?: SettlementDirection;

  @IsOptional()
  @IsUUID()
  partyId?: string;
}

export class OpenDocumentsQueryDto {
  @IsEnum(SettlementDirection)
  direction: SettlementDirection;

  @IsOptional()
  @IsUUID()
  partyId?: string;
}
