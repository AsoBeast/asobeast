import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  COUNTRY_PATTERN,
  STORE_FUNNEL_DEFAULT_DAYS,
  STORE_FUNNEL_MAX_DAYS,
} from '@asobeast/shared';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export const STORE_FUNNEL_MIN_DAYS = 7;

export class StoreFunnelQueryDto {
  @ApiPropertyOptional({
    example: 'de',
    pattern: COUNTRY_PATTERN.source,
    description:
      'Count only the storefront of this market. Omitted means every market the console reports.',
  })
  @IsOptional()
  @Matches(COUNTRY_PATTERN)
  country?: string;

  @ApiPropertyOptional({
    type: 'integer',
    minimum: STORE_FUNNEL_MIN_DAYS,
    maximum: STORE_FUNNEL_MAX_DAYS,
    default: STORE_FUNNEL_DEFAULT_DAYS,
    description: 'Days of daily points, ending today',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(STORE_FUNNEL_MIN_DAYS)
  @Max(STORE_FUNNEL_MAX_DAYS)
  days: number = STORE_FUNNEL_DEFAULT_DAYS;
}
