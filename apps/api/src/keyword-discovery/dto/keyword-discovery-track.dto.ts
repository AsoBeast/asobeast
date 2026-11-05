import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  COUNTRY_PATTERN,
  DISCOVERY_ACTION_LIMIT,
  KeywordDiscoveryTrackRequest,
} from '@asobeast/shared';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { DISCOVERY_KEYWORD_ID_MAX_LENGTH } from './keyword-discovery-dismiss.dto';

export class KeywordDiscoveryTrackDto implements KeywordDiscoveryTrackRequest {
  @ApiPropertyOptional({ type: [String], maxItems: DISCOVERY_ACTION_LIMIT })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(DISCOVERY_ACTION_LIMIT)
  @IsString({ each: true })
  @MaxLength(DISCOVERY_KEYWORD_ID_MAX_LENGTH, { each: true })
  keywordIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allRanked?: boolean;

  @ApiPropertyOptional({ example: 'de', pattern: COUNTRY_PATTERN.source })
  @IsOptional()
  @Matches(COUNTRY_PATTERN)
  country?: string;
}
