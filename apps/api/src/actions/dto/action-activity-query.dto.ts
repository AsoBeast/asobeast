import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { QUERY_BOUNDS } from '@asobeast/shared';
import { ActionScopeQueryDto } from './action-scope-query.dto';

const DAYS = QUERY_BOUNDS.actionActivityDays;

export class ActionActivityQueryDto extends ActionScopeQueryDto {
  @ApiPropertyOptional({
    default: DAYS.default,
    minimum: DAYS.min,
    maximum: DAYS.max,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(DAYS.min)
  @Max(DAYS.max)
  days = DAYS.default;
}
