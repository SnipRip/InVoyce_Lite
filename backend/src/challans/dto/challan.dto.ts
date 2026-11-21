import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsNumber, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { IsIsoDate } from '../../common/dto/field-validators.js';
import { codeOrNull, trim, trimToNull } from '../../common/dto/text-transforms.js';
import { MAX_LINE_ITEMS } from '../../pricing/dto/line-rate-options.dto.js';

// Field formats only; the service checks the customer, godown, quotation and
// stock (challan-rules.ts).

class ChallanLineDto {
  @IsUUID('4', { message: 'Pick the item' })
  itemId: string;

  /** Base units. */
  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'Quantity has at most 3 decimals' })
  @Min(0.001, { message: 'Quantity must be more than 0' })
  @Max(99_999_999)
  quantity: number;

  /** Per base unit, for the challan's value only. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(99_999_999)
  rate?: number;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string | null;
}

export class CreateChallanDto {
  @IsIsoDate('Pick the date')
  date: string;

  /** Typed only when the series allows it; blank takes the next number. */
  @Transform(codeOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(16)
  number?: string | null;

  @IsUUID('4', { message: 'Pick the customer' })
  partyId: string;

  @IsUUID('4', { message: 'Pick the godown' })
  godownId: string;

  @IsOptional()
  @IsUUID('4')
  quotationId?: string | null;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(160)
  shipToLine?: string | null;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(60)
  shipToCity?: string | null;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  vehicleNumber?: string | null;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string | null;

  @IsArray()
  @ArrayMinSize(1, { message: 'Add at least one item' })
  @ArrayMaxSize(MAX_LINE_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => ChallanLineDto)
  lines: ChallanLineDto[];
}

export class CancelChallanDto {
  @Transform(trim)
  @IsString()
  @Length(2, 200)
  reason: string;
}
