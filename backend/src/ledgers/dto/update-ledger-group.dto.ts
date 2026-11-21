import { PartialType } from '@nestjs/mapped-types';
import { CreateLedgerGroupDto } from './create-ledger-group.dto.js';

/** Send what changed. the standard groups take only the display options and notes. */
export class UpdateLedgerGroupDto extends PartialType(CreateLedgerGroupDto) {}
