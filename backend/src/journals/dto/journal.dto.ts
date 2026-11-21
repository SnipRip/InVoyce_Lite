import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsNumber, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { IsIsoDate } from '../../common/dto/field-validators.js';
import { codeOrNull, trim, trimToNull } from '../../common/dto/text-transforms.js';
import type { JournalLedgerKind, PartySide } from '../journal-rules.js';

// Field formats only; the service checks the ledgers and the rules
// (journal-rules.ts) check that the voucher balances.

const KINDS: JournalLedgerKind[] = ['ledger', 'head', 'account', 'party'];

/** The one document a settling party line is set against (Agst Ref); the rest stays as the party's credit. */
class JournalAgainstDto {
  @IsIn(['INVOICE', 'BILL', 'EXPENSE', 'OPENING', 'JOURNAL'], { message: 'Pick the document' })
  kind: 'INVOICE' | 'BILL' | 'EXPENSE' | 'OPENING' | 'JOURNAL';

  /** The invoice, bill, expense or charging journal line; for OPENING the party's own id. */
  @IsUUID('4', { message: 'Pick the document' })
  documentId: string;
}

class JournalLineDto {
  /** ledger: a general ledger; head: an expense or income head; account: a bank or cash account; party: a customer or vendor. */
  @IsIn(KINDS, { message: 'Pick a ledger' })
  kind: JournalLedgerKind;

  @IsUUID('4', { message: 'Pick a ledger' })
  id: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Amounts have at most 2 decimals' })
  @Min(0)
  @Max(9_999_999_999)
  debit: number;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Amounts have at most 2 decimals' })
  @Min(0)
  @Max(9_999_999_999)
  credit: number;

  /** Party lines: what they owe us (RECEIVABLE) or what we owe them (PAYABLE); blank takes the party's only role. */
  @IsOptional()
  @IsIn(['RECEIVABLE', 'PAYABLE'])
  partySide?: PartySide | null;

  /** Party lines that settle: the document set against. */
  @IsOptional()
  @ValidateNested()
  @Type(() => JournalAgainstDto)
  against?: JournalAgainstDto | null;
}

export class CreateJournalDto {
  @IsIsoDate('Pick the date')
  date: string;

  /** Typed only when the series allows it; blank takes the next number. */
  @Transform(codeOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  number?: string | null;

  /** Why the entry is made: it shows on every ledger statement it touches. */
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  narration?: string | null;

  @IsArray()
  @ArrayMinSize(2, { message: 'Add at least two lines' })
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines: JournalLineDto[];
}

export class CancelJournalDto {
  @Transform(trim)
  @IsString()
  @Length(2, 200)
  reason: string;
}
