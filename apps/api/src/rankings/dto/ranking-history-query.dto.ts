import { IsDateString, IsOptional, IsString } from 'class-validator';

export class RankingHistoryQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  keywordIds?: string;
}
