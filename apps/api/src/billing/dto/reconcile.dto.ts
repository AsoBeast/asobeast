import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import type { ReconcileRequest } from '@asobeast/shared';

export class ReconcileDto implements ReconcileRequest {
  @IsOptional()
  @IsString()
  @Matches(/^cs_(test|live)_[A-Za-z0-9]+$/)
  @MaxLength(255)
  sessionId?: string;
}
