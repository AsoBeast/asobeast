import { ApiPropertyOptional } from '@nestjs/swagger';
import { COUNTRY_PATTERN, KEYWORD_SORTS, KeywordSort } from '@asobeast/shared';
import { IsIn, IsOptional, Matches } from 'class-validator';

export class ListKeywordsQueryDto {
  @ApiPropertyOptional({ enum: KEYWORD_SORTS })
  @IsOptional()
  @IsIn(KEYWORD_SORTS)
  sort?: KeywordSort;

  @ApiPropertyOptional({ example: 'pl', pattern: COUNTRY_PATTERN.source })
  @IsOptional()
  @Matches(COUNTRY_PATTERN)
  country?: string;
}
