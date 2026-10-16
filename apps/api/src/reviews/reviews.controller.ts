import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RatingsHistogram, ReviewList, ReviewThemes } from '@asobeast/shared';
import { ReviewThemesQueryDto } from './dto/review-themes-query.dto';
import { ReviewsQueryDto } from './dto/reviews-query.dto';
import { ReviewThemesService } from './review-themes.service';
import { ReviewsService } from './reviews.service';

const dayOf = (value: string | undefined) =>
  value === undefined ? undefined : new Date(value);

@ApiTags('reviews')
@Controller('apps/:id/reviews')
export class ReviewsController {
  constructor(
    private readonly reviews: ReviewsService,
    private readonly themes: ReviewThemesService,
  ) {}

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
      from: dayOf(query.from),
      limit: query.limit,
      replyState: query.replyState,
      sort: query.sort,
    });
  }

  @Get('themes')
  @ApiOperation({
    summary:
      'Complaint and praise phrases that stand out in the reviews of an app against its period',
  })
  listThemes(
    @Param('id') id: string,
    @Query() query: ReviewThemesQueryDto,
  ): Promise<ReviewThemes> {
    return this.themes.themes(id, {
      score: query.score,
      version: query.version,
      from: dayOf(query.from),
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
