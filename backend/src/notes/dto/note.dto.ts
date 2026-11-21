import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { IsIsoDate } from '../../common/dto/field-validators.js';
import { codeOrNull, trim, trimToNull } from '../../common/dto/text-transforms.js';
import { NoteReason } from '../../generated/prisma/enums.js';
import { MAX_LINE_ITEMS } from '../../pricing/dto/line-rate-options.dto.js';

// Field formats only; the services check the document, what is left on each
// line and what is still due (note-rules.ts).

class NoteLineFieldsDto {
  /** Base units back (goods returned); leave out on a value-only line. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'Quantity has at most 3 decimals' })
  @Min(0)
  @Max(99_999_999)
  quantity?: number;

  /** Value-only lines: the taxable amount to take off. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Amounts have at most 2 decimals' })
  @Min(0)
  @Max(9_999_999_999)
  taxable?: number;
}

class CreditNoteLineDto extends NoteLineFieldsDto {
  @IsUUID('4', { message: 'Pick the invoice line' })
  invoiceLineId: string;
}

class DebitNoteLineDto extends NoteLineFieldsDto {
  @IsUUID('4', { message: 'Pick the bill line' })
  billLineId: string;
}

class NoteFieldsDto {
  /** False: a value-only note that leaves GST alone (a discount not agreed at the sale). Default true. */
  @IsOptional()
  @IsBoolean()
  gstAdjusted?: boolean;

  @IsIsoDate('Pick the date')
  date: string;

  /** Typed only when the series allows it; blank takes the next number. */
  @Transform(codeOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(16)
  number?: string | null;

  @IsEnum(NoteReason, { message: 'Say why the note is issued' })
  reason: NoteReason;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string | null;
}

export class CreateCreditNoteDto extends NoteFieldsDto {
  @IsUUID('4', { message: 'Pick the invoice' })
  invoiceId: string;

  /** Where goods that came back go in; needed when any line returns goods. */
  @IsOptional()
  @IsUUID('4', { message: 'Pick the godown' })
  godownId?: string | null;

  @IsArray()
  @ArrayMinSize(1, { message: 'Add at least one line' })
  @ArrayMaxSize(MAX_LINE_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => CreditNoteLineDto)
  lines: CreditNoteLineDto[];
}

export class CreateDebitNoteDto extends NoteFieldsDto {
  @IsUUID('4', { message: 'Pick the bill' })
  billId: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Add at least one line' })
  @ArrayMaxSize(MAX_LINE_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => DebitNoteLineDto)
  lines: DebitNoteLineDto[];
}

export class CancelNoteDto {
  @Transform(trim)
  @IsString()
  @Length(2, 200)
  reason: string;
}
