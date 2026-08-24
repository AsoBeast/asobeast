import { IsDateString, IsOptional } from 'class-validator';

export class CategoryRankHistoryQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
