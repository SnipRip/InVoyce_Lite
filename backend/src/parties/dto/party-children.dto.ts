import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { IsIsoDate, IsPhone } from '../../common/dto/field-validators.js';
import { codeOrNull, trim, trimToNull } from '../../common/dto/text-transforms.js';
import { GstTreatment, PartyBranchKind, PartyLicenceKind } from '../../generated/prisma/enums.js';

// A branch, contact or licence as sent with the party. A row with an `id`
// edits that row; one without is new; a stored row left out is removed (a
// branch already on a document is archived instead). `key` lets a new
// contact or licence point at a new branch sent in the same request.

export class PartyBranchDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  /** The client's key for a new branch, referred to by contacts / licences as `branchKey`. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  key?: string;

  @IsEnum(PartyBranchKind)
  kind: PartyBranchKind;

  @Transform(trim)
  @IsString()
  @Length(1, 80)
  name: string;

  @IsOptional()
  @IsEnum(GstTreatment)
  treatment?: GstTreatment | null;

  @Transform(codeOrNull)
  @IsOptional()
  @IsString()
  gstin?: string | null;

  /** GST state code; filled from the GSTIN when left out. */
  @Transform(trimToNull)
  @IsOptional()
  @Matches(/^\d{2}$/, { message: 'State is a two-digit GST state code' })
  placeOfSupply?: string | null;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(160)
  addressLine?: string | null;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(60)
  city?: string | null;

  @Transform(trimToNull)
  @IsOptional()
  @Matches(/^\d{6}$/, { message: 'PIN code is 6 digits' })
  pin?: string | null;

  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}

/** Where a contact or licence belongs: a stored branch, a new one by key, or the main branch (neither). */
class BranchLink {
  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  branchKey?: string | null;
}

export class PartyContactDto extends BranchLink {
  @IsOptional()
  @IsUUID()
  id?: string;

  @Transform(trim)
  @IsString()
  @Length(1, 80)
  name: string;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(60)
  designation?: string | null;

  @Transform(trimToNull)
  @IsOptional()
  @IsPhone()
  phone?: string | null;

  @Transform(trimToNull)
  @IsOptional()
  @IsEmail({}, { message: 'Enter a valid email' })
  @MaxLength(254)
  email?: string | null;

  @IsOptional()
  @IsBoolean()
  whatsapp?: boolean;
}

export class PartyLicenceDto extends BranchLink {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsEnum(PartyLicenceKind)
  kind: PartyLicenceKind;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(60)
  label?: string | null;

  @Transform(codeOrNull)
  @IsString()
  @Length(1, 40)
  number: string;

  @IsOptional()
  @IsIsoDate('Valid till is a date')
  validUntil?: string | null;
}
