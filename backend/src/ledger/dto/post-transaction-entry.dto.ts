import { IsString, IsEnum, IsInt, Min } from 'class-validator';
import { LedgerEntryDirection } from '@prisma/client';

export class PostTransactionEntryDto {
  @IsString()
  accountId: string;

  @IsEnum(LedgerEntryDirection)
  direction: LedgerEntryDirection;

  /** Integer monetary value (e.g. cents). No floats. */
  @IsInt()
  @Min(0)
  amount: number;
}
