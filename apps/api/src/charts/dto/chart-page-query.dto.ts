import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  CHART_COMPARE_WINDOWS,
  ChartCompareWindow,
  QUERY_BOUNDS,
  UTC_DATE_PATTERN,
} from '@asobeast/shared';
import { ChartKeyQueryDto } from './chart-key-query.dto';

export class ChartPageQueryDto extends ChartKeyQueryDto {
  @ApiPropertyOptional({
    example: '2026-10-13',
    pattern: UTC_DATE_PATTERN.source,
    description: 'The UTC day to read. Omitted reads the newest capture.',
  })
  @IsOptional()
  @Matches(UTC_DATE_PATTERN)
  @IsISO8601({ strict: true })
  date?: string;

  @ApiPropertyOptional({ enum: CHART_COMPARE_WINDOWS, default: '1d' })
  @IsOptional()
  @IsIn(CHART_COMPARE_WINDOWS)
  compare: ChartCompareWindow = '1d';

  @ApiPropertyOptional({
    type: 'integer',
    default: QUERY_BOUNDS.chartDates.default,
    description: 'How many captured days to list, newest first.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(QUERY_BOUNDS.chartDates.min)
  @Max(QUERY_BOUNDS.chartDates.max)
  dates: number = QUERY_BOUNDS.chartDates.default;
}
