import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { COUNTRY_PATTERN, QUERY_BOUNDS } from '@asobeast/shared';

export class ChangeTimelineQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(QUERY_BOUNDS.changeTimelineDays.min)
  @Max(QUERY_BOUNDS.changeTimelineDays.max)
  days = QUERY_BOUNDS.changeTimelineDays.default;

  @ApiPropertyOptional({
    example: 'de',
    pattern: COUNTRY_PATTERN.source,
    description:
      'List the changes of the listings in this storefront. Omitted means the home storefront.',
  })
  @IsOptional()
  @Matches(COUNTRY_PATTERN)
  country?: string;
}
