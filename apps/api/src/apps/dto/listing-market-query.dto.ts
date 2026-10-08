import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';
import { COUNTRY_PATTERN } from '@asobeast/shared';

export class ListingMarketQueryDto {
  @ApiPropertyOptional({
    example: 'de',
    pattern: COUNTRY_PATTERN.source,
    description:
      'The storefront whose listing to use instead of the home storefront.',
  })
  @IsOptional()
  @Matches(COUNTRY_PATTERN)
  country?: string;
}
