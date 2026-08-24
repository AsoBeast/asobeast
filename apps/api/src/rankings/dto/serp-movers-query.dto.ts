import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { QUERY_BOUNDS } from '@asobeast/shared';

export class SerpMoversQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(QUERY_BOUNDS.serpMoverDays.min)
  @Max(QUERY_BOUNDS.serpMoverDays.max)
  days = QUERY_BOUNDS.serpMoverDays.default;
}
