import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  COUNTRY_PATTERN,
  KEYWORD_INSPECTION_LIST_LIMIT,
  Store,
  STORE_SEARCH_QUERY_MAX_LENGTH,
  STORES,
} from '@asobeast/shared';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Trimmed } from '../../common/validation/trimmed.decorator';

export class ListKeywordInspectionsQueryDto {
  @ApiPropertyOptional({
    example: 'habit tracker',
    maxLength: STORE_SEARCH_QUERY_MAX_LENGTH,
  })
  @IsOptional()
  @Trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(STORE_SEARCH_QUERY_MAX_LENGTH)
  keyword?: string;

  @ApiPropertyOptional({ enum: STORES })
  @IsOptional()
  @IsIn(STORES)
  store?: Store;

  @ApiPropertyOptional({ example: 'us', pattern: COUNTRY_PATTERN.source })
  @IsOptional()
  @Matches(COUNTRY_PATTERN)
  country?: string;

  @ApiPropertyOptional({ default: KEYWORD_INSPECTION_LIST_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(KEYWORD_INSPECTION_LIST_LIMIT)
  limit?: number;
}
