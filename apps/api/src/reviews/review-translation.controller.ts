import { Body, Controller, Param, Post } from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { ReviewTranslation } from '@asobeast/shared';
import { AI_ALLOWANCE_SPENT_RESPONSE } from '../ai/ai-allowance.errors';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ReviewTranslationDto } from './dto/review-translation.dto';
import { ReviewTranslator } from './review-translator.service';

@ApiTags('reviews')
@Controller('apps/:id/reviews/:reviewId/translation')
export class ReviewTranslationController {
  constructor(private readonly translator: ReviewTranslator) {}

  @Post()
  @ApiTooManyRequestsResponse(AI_ALLOWANCE_SPENT_RESPONSE)
  @ApiOperation({
    summary:
      'Translate a review with AI, or answer the translation already kept for that language',
  })
  translate(
    @Param('id') id: string,
    @Param('reviewId') reviewId: string,
    @Body() dto: ReviewTranslationDto,
    @CurrentUser() user: User,
  ): Promise<ReviewTranslation> {
    return this.translator.translate(id, reviewId, dto.language, user.id);
  }
}
