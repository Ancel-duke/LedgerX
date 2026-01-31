import { IsString, IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { PostTransactionEntryDto } from './post-transaction-entry.dto';

export class PostTransactionDto {
  @IsString()
  referenceType: string;

  @IsString()
  referenceId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostTransactionEntryDto)
  @ArrayMinSize(2, { message: 'At least two entries required for a balanced transaction' })
  entries: PostTransactionEntryDto[];
}
