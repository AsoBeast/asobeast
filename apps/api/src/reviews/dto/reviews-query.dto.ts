import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { QUERY_BOUNDS } from '@asobeast/shared';

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

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(QUERY_BOUNDS.reviewsLimit.min)
  @Max(QUERY_BOUNDS.reviewsLimit.max)
  limit = QUERY_BOUNDS.reviewsLimit.default;
}
