import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { trimToNull } from '../../common/dto/text-transforms.js';
import { NumberingMethod } from '../../generated/prisma/enums.js';

// Send what changed. The method cannot be cleared; the voucher type can
// (blank or null: this kind is not synced as a voucher).
export class UpdateNumberSeriesDto {
  @ValidateIf((_: object, value: unknown) => value !== undefined)
  @IsEnum(NumberingMethod, { message: 'Pick how numbers are given' })
  method?: NumberingMethod;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(60)
  voucherType?: string | null;
}
