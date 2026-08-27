import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  COUNTRY_PATTERN,
  KEYWORD_BULK_ADD_LIMIT,
  KeywordAddRequest,
} from '@asobeast/shared';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class AddKeywordsDto implements KeywordAddRequest {
  @ApiProperty({
    example: ['habit tracker', 'streak counter'],
    maxItems: KEYWORD_BULK_ADD_LIMIT,
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(KEYWORD_BULK_ADD_LIMIT)
  @IsString({ each: true })
  keywords!: string[];

  @ApiPropertyOptional({ example: 'pl', pattern: COUNTRY_PATTERN.source })
  @IsOptional()
  @Matches(COUNTRY_PATTERN)
  country?: string;
}
