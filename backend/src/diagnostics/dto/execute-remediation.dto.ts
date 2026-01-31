import { IsEnum, IsBoolean, IsObject, IsOptional } from 'class-validator';
import { AllowedRemediationAction } from '../diagnostics.types';

export class ExecuteRemediationDto {
  @IsEnum(AllowedRemediationAction)
  action: AllowedRemediationAction;

  @IsOptional()
  @IsObject()
  params?: Record<string, string>;

  /** Explicit approval required; request is rejected if not true. */
  @IsBoolean()
  approved: boolean;
}
