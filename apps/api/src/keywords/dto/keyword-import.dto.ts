import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  COUNTRY_PATTERN,
  KEYWORD_IMPORT_LIMIT,
  KeywordImportRequest,
  KeywordImportRow,
} from '@asobeast/shared';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

export class KeywordImportRowDto implements KeywordImportRow {
  @ApiProperty({ example: 'habit tracker' })
  @IsString()
  keyword!: string;

  @ApiPropertyOptional({ example: 'pl', nullable: true, type: String })
  @IsOptional()
  @IsString()
  country?: string | null;

  @ApiPropertyOptional({ example: ['core', 'brand'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: 'Q4 push', nullable: true, type: String })
  @IsOptional()
  @IsString()
  note?: string | null;
}

export class KeywordImportDto implements KeywordImportRequest {
  @ApiProperty({ type: [KeywordImportRowDto], maxItems: KEYWORD_IMPORT_LIMIT })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(KEYWORD_IMPORT_LIMIT)
  @ValidateNested({ each: true })
  @Type(() => KeywordImportRowDto)
  rows!: KeywordImportRowDto[];

  @ApiPropertyOptional({ example: 'us', pattern: COUNTRY_PATTERN.source })
  @IsOptional()
  @Matches(COUNTRY_PATTERN)
  country?: string;
}
