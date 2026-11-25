import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { QUERY_BOUNDS } from '@asobeast/shared';

export class RecentChangesQueryDto {
  @ApiPropertyOptional({ type: 'integer' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(QUERY_BOUNDS.recentChangesLimit.min)
  @Max(QUERY_BOUNDS.recentChangesLimit.max)
  limit: number = QUERY_BOUNDS.recentChangesLimit.default;
}
