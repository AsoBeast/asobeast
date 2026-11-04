import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, Max, Min, ValidateIf } from 'class-validator';
import {
  RATING_DROP_MAX_TENTHS,
  RATING_DROP_MIN_TENTHS,
} from '@asobeast/shared';

export function RatingDropTenths(): PropertyDecorator {
  return applyDecorators(
    ApiPropertyOptional({
      type: 'integer',
      minimum: RATING_DROP_MIN_TENTHS,
      maximum: RATING_DROP_MAX_TENTHS,
      example: 2,
      description:
        'The smallest fall of the average rating, in tenths of a star, a rating.dropped alert is raised for. Omitted means 1, a tenth of a star.',
    }),
    ValidateIf((_, value) => value !== undefined),
    IsInt(),
    Min(RATING_DROP_MIN_TENTHS),
    Max(RATING_DROP_MAX_TENTHS),
  );
}
