import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  DEFAULT_PORTFOLIO_HISTORY_DAYS,
  PORTFOLIO_HISTORY_DAYS,
  STORES,
  type PortfolioHistoryDays,
  type PortfolioHistoryScope,
  type Store,
} from '@asobeast/shared';

const APP_ID_MAX_LENGTH = 64;

export class PortfolioHistoryQueryDto implements PortfolioHistoryScope {
  @ApiPropertyOptional({
    enum: PORTFOLIO_HISTORY_DAYS,
    default: DEFAULT_PORTFOLIO_HISTORY_DAYS,
  })
  @IsOptional()
  @Type(() => Number)
  @IsIn(PORTFOLIO_HISTORY_DAYS)
  days: PortfolioHistoryDays = DEFAULT_PORTFOLIO_HISTORY_DAYS;

  @ApiPropertyOptional({
    description: 'Answer for this primary app alone.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(APP_ID_MAX_LENGTH)
  appId?: string;

  @ApiPropertyOptional({
    enum: STORES,
    description: 'Answer for the primary apps of this store alone.',
  })
  @IsOptional()
  @IsIn(STORES)
  store?: Store;
}
