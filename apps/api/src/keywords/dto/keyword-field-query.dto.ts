import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  APP_STORE_LOCALIZATION_IDS,
  type AppStoreLocalization,
  COUNTRY_PATTERN,
  KeywordFieldQuery,
} from '@asobeast/shared';
import { IsIn, IsOptional, Matches } from 'class-validator';

export class KeywordFieldQueryDto implements KeywordFieldQuery {
  @ApiPropertyOptional({
    example: 'us',
    pattern: COUNTRY_PATTERN.source,
    description:
      'The storefront the field is read in and its phrases are tracked in. Omitted means the home storefront.',
  })
  @IsOptional()
  @Matches(COUNTRY_PATTERN)
  country?: string;

  @ApiPropertyOptional({
    example: 'es-MX',
    enum: APP_STORE_LOCALIZATION_IDS,
    description:
      "The App Store localization whose keyword field this is. It must be one the storefront reads. Omitted means the storefront's default localization.",
  })
  @IsOptional()
  @IsIn(APP_STORE_LOCALIZATION_IDS)
  localization?: AppStoreLocalization;
}
