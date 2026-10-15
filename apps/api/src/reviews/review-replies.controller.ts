import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { ReviewReplyDraftResult, ReviewReplyItem } from '@asobeast/shared';
import { AI_ALLOWANCE_SPENT_RESPONSE } from '../ai/ai-allowance.errors';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ReviewReplyDraftDto } from './dto/review-reply-draft.dto';
import { ReviewReplyPatchDto } from './dto/review-reply-patch.dto';
import { ReviewRepliesService } from './review-replies.service';
import { ReviewReplyAssistant } from './review-reply-assistant.service';

@ApiTags('reviews')
@Controller('apps/:id/reviews/:reviewId/reply')
export class ReviewRepliesController {
  constructor(
    private readonly replies: ReviewRepliesService,
    private readonly assistant: ReviewReplyAssistant,
  ) {}

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

  @Post('draft')
  @ApiTooManyRequestsResponse(AI_ALLOWANCE_SPENT_RESPONSE)
  @ApiOperation({
    summary: 'Draft the reply to a review with AI and keep it on the review',
  })
  draft(
    @Param('id') id: string,
    @Param('reviewId') reviewId: string,
    @Body() dto: ReviewReplyDraftDto,
    @CurrentUser() user: User,
  ): Promise<ReviewReplyDraftResult> {
    return this.assistant.draft(id, reviewId, dto, user.id);
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
