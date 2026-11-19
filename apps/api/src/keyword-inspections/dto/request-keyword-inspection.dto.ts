import { ApiProperty } from '@nestjs/swagger';
import {
  COUNTRY_PATTERN,
  KeywordInspectionRequest,
  Store,
  STORE_SEARCH_QUERY_MAX_LENGTH,
  STORES,
} from '@asobeast/shared';
import {
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Trimmed } from '../../common/validation/trimmed.decorator';

export class RequestKeywordInspectionDto implements KeywordInspectionRequest {
  @ApiProperty({
    example: 'habit tracker',
    maxLength: STORE_SEARCH_QUERY_MAX_LENGTH,
  })
  @Trimmed()
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
