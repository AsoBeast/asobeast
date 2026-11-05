import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  COUNTRY_PATTERN,
  DISCOVERY_LIST_LIMIT,
  DISCOVERY_STATES,
  DiscoveryState,
} from '@asobeast/shared';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export class KeywordDiscoveriesQueryDto {
  @ApiPropertyOptional({ example: 'de', pattern: COUNTRY_PATTERN.source })
  @IsOptional()
  @Matches(COUNTRY_PATTERN)
  country?: string;

  @ApiPropertyOptional({ enum: DISCOVERY_STATES, default: 'all' })
  @IsOptional()
  @IsIn(DISCOVERY_STATES)
  state: DiscoveryState = 'all';

  @ApiPropertyOptional({ default: DISCOVERY_LIST_LIMIT.default })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(DISCOVERY_LIST_LIMIT.min)
  @Max(DISCOVERY_LIST_LIMIT.max)
  limit: number = DISCOVERY_LIST_LIMIT.default;
}
