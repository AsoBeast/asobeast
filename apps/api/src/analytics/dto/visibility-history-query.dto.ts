import { IsDateString, IsOptional } from 'class-validator';

export class VisibilityHistoryQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
