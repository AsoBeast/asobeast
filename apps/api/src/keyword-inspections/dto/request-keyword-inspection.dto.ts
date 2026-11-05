import { ApiProperty } from '@nestjs/swagger';
import {
  COUNTRY_PATTERN,
  KeywordInspectionRequest,
  Store,
  STORE_SEARCH_QUERY_MAX_LENGTH,
  STORES,
} from '@asobeast/shared';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class RequestKeywordInspectionDto implements KeywordInspectionRequest {
  @ApiProperty({
    example: 'habit tracker',
    maxLength: STORE_SEARCH_QUERY_MAX_LENGTH,
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(STORE_SEARCH_QUERY_MAX_LENGTH)
  keyword!: string;

  @ApiProperty({ enum: STORES })
  @IsIn(STORES)
  store!: Store;

  @ApiProperty({ example: 'us', pattern: COUNTRY_PATTERN.source })
  @Matches(COUNTRY_PATTERN)
  country!: string;
}
