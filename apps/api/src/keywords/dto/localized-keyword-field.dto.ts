import { ApiProperty } from '@nestjs/swagger';
import {
  COUNTRY_PATTERN,
  KEYWORD_FIELD_INPUT_LIMIT,
  LocalizedKeywordFieldRequest,
} from '@asobeast/shared';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export const TRACK_IN_LIMIT = 200;

export class LocalizedKeywordFieldDto implements LocalizedKeywordFieldRequest {
  @ApiProperty({
    example: 'habit,tracker,streak',
    maxLength: KEYWORD_FIELD_INPUT_LIMIT,
  })
  @IsString()
  @MaxLength(KEYWORD_FIELD_INPUT_LIMIT)
  text!: string;

  @ApiProperty({
    type: [String],
    example: ['us', 'mx'],
    maxItems: TRACK_IN_LIMIT,
    description:
      'The markets of the app that track the phrases of this field. Every one must be a market of the app whose storefront reads the localization. An empty list stores the field and tracks nothing.',
  })
  @IsArray()
  @ArrayMaxSize(TRACK_IN_LIMIT)
  @ArrayUnique()
  @Matches(COUNTRY_PATTERN, { each: true })
  trackIn!: string[];
}
