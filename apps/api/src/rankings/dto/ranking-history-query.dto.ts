import { IsISO8601, IsOptional, IsString } from 'class-validator';
import { NotBefore } from '../../common/validation/not-before.decorator';

export class RankingHistoryQueryDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @NotBefore('from')
  to?: string;

  @IsOptional()
  @IsString()
  keywordIds?: string;
}
