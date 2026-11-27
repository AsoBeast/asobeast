import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  APP_STORE_LOCALIZATION_IDS,
  AppStoreLocalization,
  COUNTRY_PATTERN,
  CoveragePreviewRequest,
  KEYWORD_FIELD_INPUT_LIMIT,
  STORE_FIELD_LIMITS,
} from '@asobeast/shared';
import {
  IsIn,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export const DESCRIPTION_INPUT_LIMIT =
  STORE_FIELD_LIMITS.GOOGLE_PLAY.description!.limit;

const isPresent = (_: object, value: unknown): boolean => value !== undefined;

export class CoveragePreviewDto implements CoveragePreviewRequest {
  @ApiPropertyOptional({
    example: 'en-US',
    enum: APP_STORE_LOCALIZATION_IDS,
    description:
      'The App Store localization the draft rewrites. Defaults to the home localization, the one the home listing is written in. App Store only.',
  })
  @ValidateIf(isPresent)
  @IsIn(APP_STORE_LOCALIZATION_IDS)
  localization?: AppStoreLocalization;

  @ApiPropertyOptional({
    example: 'us',
    pattern: COUNTRY_PATTERN.source,
    description:
      'The market whose listing the draft rewrites. Defaults to the home storefront. Google Play only.',
  })
  @ValidateIf(isPresent)
  @Matches(COUNTRY_PATTERN)
  country?: string;

  @ApiPropertyOptional({
    example: 'Habit Tracker',
    maxLength: KEYWORD_FIELD_INPUT_LIMIT,
    description: 'The drafted title. Left out, the live title is kept.',
  })
  @ValidateIf(isPresent)
  @IsString()
  @MaxLength(KEYWORD_FIELD_INPUT_LIMIT)
  title?: string;

  @ApiPropertyOptional({
    example: 'Daily goals and streaks',
    maxLength: KEYWORD_FIELD_INPUT_LIMIT,
    description:
      'The drafted subtitle. Left out, the live subtitle is kept. App Store only.',
  })
  @ValidateIf(isPresent)
  @IsString()
  @MaxLength(KEYWORD_FIELD_INPUT_LIMIT)
  subtitle?: string;

  @ApiPropertyOptional({
    example: 'Build habits that stick',
    maxLength: KEYWORD_FIELD_INPUT_LIMIT,
    description:
      'The drafted short description. Left out, the live one is kept. Google Play only.',
  })
  @ValidateIf(isPresent)
  @IsString()
  @MaxLength(KEYWORD_FIELD_INPUT_LIMIT)
  shortDescription?: string;

  @ApiPropertyOptional({
    example: 'habit,tracker,streak',
    maxLength: KEYWORD_FIELD_INPUT_LIMIT,
    description:
      'The drafted keyword field of the localization. Left out, the saved field is kept; an empty string drafts an empty field. App Store only.',
  })
  @ValidateIf(isPresent)
  @IsString()
  @MaxLength(KEYWORD_FIELD_INPUT_LIMIT)
  keywordField?: string;

  @ApiPropertyOptional({
    example: 'Track every habit.',
    maxLength: DESCRIPTION_INPUT_LIMIT,
    description: 'The drafted description. Left out, the live one is kept.',
  })
  @ValidateIf(isPresent)
  @IsString()
  @MaxLength(DESCRIPTION_INPUT_LIMIT)
  description?: string;
}
