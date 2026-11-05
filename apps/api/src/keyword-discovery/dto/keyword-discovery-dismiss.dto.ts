import { ApiProperty } from '@nestjs/swagger';
import {
  DISCOVERY_ACTION_LIMIT,
  KeywordDiscoveryDismissRequest,
} from '@asobeast/shared';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsString,
  MaxLength,
} from 'class-validator';

export const DISCOVERY_KEYWORD_ID_MAX_LENGTH = 64;

export class KeywordDiscoveryDismissDto implements KeywordDiscoveryDismissRequest {
  @ApiProperty({ type: [String], maxItems: DISCOVERY_ACTION_LIMIT })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(DISCOVERY_ACTION_LIMIT)
  @IsString({ each: true })
  @MaxLength(DISCOVERY_KEYWORD_ID_MAX_LENGTH, { each: true })
  keywordIds!: string[];
}
