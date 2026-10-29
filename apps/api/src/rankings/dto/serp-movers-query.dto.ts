import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { COUNTRY_PATTERN, QUERY_BOUNDS } from '@asobeast/shared';

export class SerpMoversQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(QUERY_BOUNDS.serpMoverDays.min)
  @Max(QUERY_BOUNDS.serpMoverDays.max)
  days = QUERY_BOUNDS.serpMoverDays.default;

  @ApiPropertyOptional({
    example: 'us',
    pattern: COUNTRY_PATTERN.source,
    description:
      'The storefront whose tracked keywords are described. Omitted means every market the app tracks.',
  })
  @IsOptional()
  @Matches(COUNTRY_PATTERN)
  country?: string;
}
