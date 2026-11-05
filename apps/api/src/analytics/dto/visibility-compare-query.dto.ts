import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { VISIBILITY_COMPARISONS, VisibilityComparison } from '@asobeast/shared';
import { IsIn, IsOptional } from 'class-validator';
import { MarketHistoryQueryDto } from './market-history-query.dto';

class ComparisonQueryDto {
  @ApiPropertyOptional({
    enum: VISIBILITY_COMPARISONS,
    description:
      'competitors adds shareOfVoice and nonBrandedShareOfVoice series: the app visibility divided by the summed visibility of the app and the tracked competitors checked that day.',
  })
  @IsOptional()
  @IsIn(VISIBILITY_COMPARISONS)
  compare?: VisibilityComparison;
}

export class VisibilityCompareQueryDto extends IntersectionType(
  MarketHistoryQueryDto,
  ComparisonQueryDto,
) {}
