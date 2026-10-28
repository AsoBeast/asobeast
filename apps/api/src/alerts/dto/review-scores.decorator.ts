import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsIn, ValidateIf } from 'class-validator';
import { normalizeReviewScores, REVIEW_SCORES } from '@asobeast/shared';

const isNumberList = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'number');

export function ReviewScoresFilter(): PropertyDecorator {
  return applyDecorators(
    ApiPropertyOptional({
      type: 'array',
      items: { type: 'integer', enum: [...REVIEW_SCORES] },
      example: [1, 2],
      description:
        'The stars a review.new alert is raised for. Empty or omitted means every star.',
    }),
    ValidateIf((_, value) => value !== undefined),
    Transform(({ value }: { value: unknown }) =>
      isNumberList(value) ? normalizeReviewScores(value) : value,
    ),
    IsArray(),
    IsIn(REVIEW_SCORES, { each: true }),
  );
}
