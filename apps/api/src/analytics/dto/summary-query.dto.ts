import { ApiPropertyOptional } from '@nestjs/swagger';
import { COUNTRY_PATTERN } from '@asobeast/shared';
import { IsOptional, Matches } from 'class-validator';

export class SummaryQueryDto {
  @ApiPropertyOptional({
    example: 'de',
    pattern: COUNTRY_PATTERN.source,
    description:
      'Count only the keywords tracked in this storefront. Omitted means every market the app tracks.',
  })
  @IsOptional()
  @Matches(COUNTRY_PATTERN)
  country?: string;
}
