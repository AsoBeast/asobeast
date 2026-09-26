import { ApiPropertyOptional } from '@nestjs/swagger';
import { COUNTRY_PATTERN, QUERY_BOUNDS } from '@asobeast/shared';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export class ChangeImpactQueryDto {
  @ApiPropertyOptional({
    type: 'integer',
    default: QUERY_BOUNDS.changeTimelineDays.default,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(QUERY_BOUNDS.changeTimelineDays.min)
  @Max(QUERY_BOUNDS.changeTimelineDays.max)
  days = QUERY_BOUNDS.changeTimelineDays.default;

  @ApiPropertyOptional({ example: 'de', pattern: COUNTRY_PATTERN.source })
  @IsOptional()
  @Matches(COUNTRY_PATTERN)
  country?: string;
}
