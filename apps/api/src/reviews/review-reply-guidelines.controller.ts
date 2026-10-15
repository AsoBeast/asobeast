import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReviewReplyGuidelines } from '@asobeast/shared';
import { ReviewReplyGuidelinesDto } from './dto/review-reply-guidelines.dto';
import { ReviewRepliesService } from './review-replies.service';

@ApiTags('reviews')
@Controller('apps/:id/reviews/reply-guidelines')
export class ReviewReplyGuidelinesController {
  constructor(private readonly replies: ReviewRepliesService) {}

  @Get()
  @ApiOperation({ summary: 'The reply guidelines every AI draft follows' })
  read(@Param('id') id: string): Promise<ReviewReplyGuidelines> {
    return this.replies.guidelines(id);
  }

  @Put()
  @ApiOperation({ summary: 'Replace the reply guidelines of an app' })
  write(
    @Param('id') id: string,
    @Body() dto: ReviewReplyGuidelinesDto,
  ): Promise<ReviewReplyGuidelines> {
    return this.replies.setGuidelines(id, dto.guidelines);
  }
}
