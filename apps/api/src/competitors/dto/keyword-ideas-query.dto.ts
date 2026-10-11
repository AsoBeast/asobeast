import { ApiPropertyOptional } from '@nestjs/swagger';
import { COUNTRY_PATTERN } from '@asobeast/shared';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export class KeywordIdeasQueryDto {
  @ApiPropertyOptional({
    example: 'de',
    pattern: COUNTRY_PATTERN.source,
    description:
      'Storefront to read competitor listings and search suggestions in. Omitted means the home market of the app.',
  })
  @IsOptional()
  @Matches(COUNTRY_PATTERN)
  country?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 50;
}
