import { ApiProperty } from '@nestjs/swagger';
import {
  KEYWORD_BULK_ACTIONS,
  KEYWORD_BULK_CHANGE_LIMIT,
  KeywordBulkAction,
  KeywordBulkRequest,
} from '@asobeast/shared';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsString,
  MaxLength,
} from 'class-validator';

const KEYWORD_ID_MAX_LENGTH = 64;

export class KeywordBulkDto implements KeywordBulkRequest {
  @ApiProperty({ enum: KEYWORD_BULK_ACTIONS })
  @IsIn(KEYWORD_BULK_ACTIONS)
  action!: KeywordBulkAction;

  @ApiProperty({ type: [String], maxItems: KEYWORD_BULK_CHANGE_LIMIT })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(KEYWORD_BULK_CHANGE_LIMIT)
  @IsString({ each: true })
  @MaxLength(KEYWORD_ID_MAX_LENGTH, { each: true })
  keywordIds!: string[];
}
