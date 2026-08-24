import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { QUERY_BOUNDS } from '@asobeast/shared';

export class ChangeTimelineQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(QUERY_BOUNDS.changeTimelineDays.min)
  @Max(QUERY_BOUNDS.changeTimelineDays.max)
  days = QUERY_BOUNDS.changeTimelineDays.default;
}
