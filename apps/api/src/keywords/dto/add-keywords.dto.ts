import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { COUNTRY_PATTERN, KeywordAddRequest } from '@asobeast/shared';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

const MAX_KEYWORDS_PER_REQUEST = 200;

export class AddKeywordsDto implements KeywordAddRequest {
  @ApiProperty({
    example: ['habit tracker', 'streak counter'],
    maxItems: MAX_KEYWORDS_PER_REQUEST,
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_KEYWORDS_PER_REQUEST)
  @IsString({ each: true })
  keywords!: string[];

  @ApiPropertyOptional({ example: 'pl', pattern: COUNTRY_PATTERN.source })
  @IsOptional()
  @Matches(COUNTRY_PATTERN)
  country?: string;
}
