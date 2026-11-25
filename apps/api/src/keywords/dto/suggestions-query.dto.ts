import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  COUNTRY_PATTERN,
  KEYWORD_SUGGESTION_STRATEGIES,
  KeywordSuggestionStrategy,
  QUERY_BOUNDS,
} from '@asobeast/shared';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export class SuggestionsQueryDto {
  @ApiPropertyOptional({ enum: KEYWORD_SUGGESTION_STRATEGIES })
  @IsOptional()
  @IsIn(KEYWORD_SUGGESTION_STRATEGIES)
  strategy: KeywordSuggestionStrategy = 'metadata';

  @ApiPropertyOptional({ example: 'pl', pattern: COUNTRY_PATTERN.source })
  @IsOptional()
  @Matches(COUNTRY_PATTERN)
  country?: string;

  @ApiPropertyOptional({ type: 'integer', default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(QUERY_BOUNDS.suggestionsLimit.min)
  @Max(QUERY_BOUNDS.suggestionsLimit.max)
  limit: number = QUERY_BOUNDS.suggestionsLimit.default;
}
