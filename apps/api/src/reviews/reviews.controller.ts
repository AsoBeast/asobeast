import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RatingsHistogram, ReviewList } from '@asobeast/shared';
import { ReviewsQueryDto } from './dto/reviews-query.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('reviews')
@Controller('apps/:id/reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Stored reviews for an app, filtered by star, version, date and reply state',
  })
  list(
    @Param('id') id: string,
    @Query() query: ReviewsQueryDto,
  ): Promise<ReviewList> {
    return this.reviews.list(id, {
      score: query.score,
      version: query.version,
      from: query.from === undefined ? undefined : new Date(query.from),
      limit: query.limit,
      replyState: query.replyState,
      sort: query.sort,
    });
  }

  @Get('histogram')
  @ApiOperation({
    summary: 'Ratings distribution from the latest snapshot (Google Play only)',
  })
  histogram(@Param('id') id: string): Promise<RatingsHistogram> {
    return this.reviews.histogram(id);
  }
}
