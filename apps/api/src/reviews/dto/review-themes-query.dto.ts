import { PickType } from '@nestjs/swagger';
import { ReviewsQueryDto } from './reviews-query.dto';

export class ReviewThemesQueryDto extends PickType(ReviewsQueryDto, [
  'version',
  'from',
] as const) {}
