import { ApiPropertyOptional } from '@nestjs/swagger';
import { COUNTRY_PATTERN } from '@asobeast/shared';
import { IsOptional, Matches } from 'class-validator';

export class MarketQueryDto {
  @ApiPropertyOptional({
    example: 'us',
    pattern: COUNTRY_PATTERN.source,
    description:
      'The storefront whose search is described. Omitted means the home storefront of the app.',
  })
  @IsOptional()
  @Matches(COUNTRY_PATTERN)
  country?: string;
}
