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
import {
  ReviewReplyDraftResult,
  ReviewReplyItem,
  ReviewReplyPostResult,
} from '@asobeast/shared';
import { AI_ALLOWANCE_SPENT_RESPONSE } from '../ai/ai-allowance.errors';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SessionOnly } from '../auth/decorators/session-only.decorator';
import { ReviewReplyDraftDto } from './dto/review-reply-draft.dto';
import { ReviewReplyPatchDto } from './dto/review-reply-patch.dto';
import { ReviewRepliesService } from './review-replies.service';
import { ReviewReplyAssistant } from './review-reply-assistant.service';
import { ReviewReplyPoster } from './review-reply-poster.service';

@ApiTags('reviews')
@Controller('apps/:id/reviews/:reviewId/reply')
export class ReviewRepliesController {
  constructor(
    private readonly replies: ReviewRepliesService,
    private readonly assistant: ReviewReplyAssistant,
    private readonly poster: ReviewReplyPoster,
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

  @Post('post')
  @HttpCode(200)
  @SessionOnly()
  @ApiOperation({
    summary: 'Post the kept reply of a review to its store',
    description:
      'Sends the saved reply text to App Store Connect or Google Play with the key connected in Integrations, records when and what was posted, and marks the review replied. Posting again after an edit replaces the reply on the store. Through a signed in session only. Answers 400 without saved text or over the store limit, 403 when the connected key may not reply, 404 when the store does not know the review, 409 without a usable connection, 422 when the store refuses the reply and 429 when the store asks to slow down.',
  })
  post(
    @Param('id') id: string,
    @Param('reviewId') reviewId: string,
    @CurrentUser() user: User,
  ): Promise<ReviewReplyPostResult> {
    return this.poster.post(id, reviewId, user.id);
  }

  @Delete('post')
  @SessionOnly()
  @ApiOperation({
    summary: 'Withdraw the reply posted to the App Store',
    description:
      'Deletes the response posted to App Store Connect and clears the post, keeping the reply text. Through a signed in session only. Answers 404 when nothing was posted and 409 for a Google Play review, whose API offers no removal.',
  })
  withdraw(
    @Param('id') id: string,
    @Param('reviewId') reviewId: string,
  ): Promise<ReviewReplyPostResult> {
    return this.poster.withdraw(id, reviewId);
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
