import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { COUNTRY_PATTERN, KeywordAddRequest } from '@asobeast/shared';
import {
  ArrayNotEmpty,
  IsArray,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class AddKeywordsDto implements KeywordAddRequest {
  @ApiProperty({ example: ['habit tracker', 'streak counter'] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  keywords!: string[];

  @ApiPropertyOptional({ example: 'pl', pattern: COUNTRY_PATTERN.source })
  @IsOptional()
  @Matches(COUNTRY_PATTERN)
  country?: string;
}
