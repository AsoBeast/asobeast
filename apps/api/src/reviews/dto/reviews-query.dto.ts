import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  QUERY_BOUNDS,
  REVIEW_REPLY_STATES,
  REVIEW_SORTS,
  type ReviewReplyState,
  type ReviewSort,
} from '@asobeast/shared';

export class ReviewsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(QUERY_BOUNDS.reviewScore.min)
  @Max(QUERY_BOUNDS.reviewScore.max)
  score?: number;

  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional({
    description: 'Only reviews written on or after this UTC date',
    example: '2026-09-15',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(QUERY_BOUNDS.reviewsLimit.min)
  @Max(QUERY_BOUNDS.reviewsLimit.max)
  limit = QUERY_BOUNDS.reviewsLimit.default;

  @ApiPropertyOptional({ enum: REVIEW_REPLY_STATES })
  @IsOptional()
  @IsIn([...REVIEW_REPLY_STATES])
  replyState?: ReviewReplyState;

  @ApiPropertyOptional({ enum: REVIEW_SORTS, default: 'newest' })
  @IsOptional()
  @IsIn([...REVIEW_SORTS])
  sort: ReviewSort = 'newest';
}
