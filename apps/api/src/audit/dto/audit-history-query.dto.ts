import { IsDateString, IsOptional } from 'class-validator';

export class AuditHistoryQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
