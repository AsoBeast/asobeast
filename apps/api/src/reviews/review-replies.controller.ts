import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Patch,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReviewReplyItem } from '@asobeast/shared';
import { ReviewReplyPatchDto } from './dto/review-reply-patch.dto';
import { ReviewRepliesService } from './review-replies.service';

@ApiTags('reviews')
@Controller('apps/:id/reviews/:reviewId/reply')
export class ReviewRepliesController {
  constructor(private readonly replies: ReviewRepliesService) {}

  @Patch()
  @ApiOperation({
    summary: 'Save the reply text of a review or mark it as replied',
  })
  patch(
    @Param('id') id: string,
    @Param('reviewId') reviewId: string,
    @Body() dto: ReviewReplyPatchDto,
  ): Promise<ReviewReplyItem> {
    return this.replies.patch(id, reviewId, dto);
  }

  @Delete()
  @HttpCode(204)
  @ApiOperation({ summary: 'Discard the reply kept for a review' })
  remove(
    @Param('id') id: string,
    @Param('reviewId') reviewId: string,
  ): Promise<void> {
    return this.replies.remove(id, reviewId);
  }
}
