import { IsString, IsEnum, IsOptional, MaxLength } from 'class-validator';
import { LedgerAccountType } from '@prisma/client';

export class CreateLedgerAccountDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsEnum(LedgerAccountType)
  type: LedgerAccountType;

  @IsString()
  @IsOptional()
  currency?: string;
}
