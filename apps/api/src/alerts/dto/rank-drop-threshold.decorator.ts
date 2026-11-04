import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  RANK_DROP_THRESHOLD_MAX,
  RANK_DROP_THRESHOLD_MIN,
} from '@asobeast/shared';

export function RankDropThresholdField(): PropertyDecorator {
  return applyDecorators(
    ApiPropertyOptional({
      type: 'integer',
      nullable: true,
      minimum: RANK_DROP_THRESHOLD_MIN,
      maximum: RANK_DROP_THRESHOLD_MAX,
      example: 10,
      description:
        'Positions a keyword must move before rank.dropped or rank.improved reaches this subscription. Null or omitted uses ALERT_RANK_DROP_THRESHOLD, and a smaller value counts as ALERT_RANK_DROP_THRESHOLD.',
    }),
    IsOptional(),
    IsInt(),
    Min(RANK_DROP_THRESHOLD_MIN),
    Max(RANK_DROP_THRESHOLD_MAX),
  );
}
