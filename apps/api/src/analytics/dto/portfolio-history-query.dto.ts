import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import {
  DEFAULT_PORTFOLIO_HISTORY_DAYS,
  PORTFOLIO_HISTORY_DAYS,
  type PortfolioHistoryDays,
} from '@asobeast/shared';

export class PortfolioHistoryQueryDto {
  @ApiPropertyOptional({
    enum: PORTFOLIO_HISTORY_DAYS,
    default: DEFAULT_PORTFOLIO_HISTORY_DAYS,
  })
  @IsOptional()
  @Type(() => Number)
  @IsIn(PORTFOLIO_HISTORY_DAYS)
  days: PortfolioHistoryDays = DEFAULT_PORTFOLIO_HISTORY_DAYS;
}
