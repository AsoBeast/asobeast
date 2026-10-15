import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import {
  REVIEW_TRANSLATION_LANGUAGE,
  ReviewTranslationRequest,
} from '@asobeast/shared';

export class ReviewTranslationDto implements ReviewTranslationRequest {
  @ApiProperty({
    description: 'ISO 639 code of the language to translate into',
    example: 'en',
  })
  @Matches(REVIEW_TRANSLATION_LANGUAGE)
  language!: string;
}
