import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Matches, MaxLength } from 'class-validator';
import {
  CATEGORY_COLLECTIONS,
  CategoryCollection,
  CHART_DEVICES,
  ChartDevice,
  ChartKey,
  COUNTRY_PATTERN,
  Store,
  STORES,
} from '@asobeast/shared';

export class ChartKeyQueryDto implements ChartKey {
  @ApiProperty({ enum: STORES })
  @IsIn(STORES)
  store!: Store;

  @ApiProperty({ example: 'us', pattern: COUNTRY_PATTERN.source })
  @Matches(COUNTRY_PATTERN)
  country!: string;

  @ApiProperty({ enum: CATEGORY_COLLECTIONS })
  @IsIn(CATEGORY_COLLECTIONS)
  collection!: CategoryCollection;

  @ApiProperty({
    example: '6014',
    description: 'A chart genre of the store, or overall',
  })
  @IsString()
  @MaxLength(32)
  genre!: string;

  @ApiProperty({ enum: CHART_DEVICES })
  @IsIn(CHART_DEVICES)
  device!: ChartDevice;
}
