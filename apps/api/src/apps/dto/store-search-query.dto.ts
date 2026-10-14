import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  COUNTRY_PATTERN,
  QUERY_BOUNDS,
  Store,
  STORE_SEARCH_QUERY_MAX_LENGTH,
  STORES,
} from '@asobeast/shared';
import { Transform, Type } from 'class-transformer';
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

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class StoreSearchQueryDto {
  @ApiProperty({ enum: STORES })
  @IsIn(STORES)
  store!: Store;

  @ApiProperty({ example: 'us', pattern: COUNTRY_PATTERN.source })
  @Matches(COUNTRY_PATTERN)
  country!: string;

  @ApiProperty({
    example: 'focus timer',
    maxLength: STORE_SEARCH_QUERY_MAX_LENGTH,
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(STORE_SEARCH_QUERY_MAX_LENGTH)
  q!: string;

  @ApiPropertyOptional({ default: QUERY_BOUNDS.storeSearchLimit.default })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(QUERY_BOUNDS.storeSearchLimit.min)
  @Max(QUERY_BOUNDS.storeSearchLimit.max)
  limit = QUERY_BOUNDS.storeSearchLimit.default;
}
