import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  REVIEW_REPLY_INSTRUCTIONS_MAX,
  REVIEW_REPLY_TONES,
  type ReviewReplyDraftRequest,
  type ReviewReplyTone,
} from '@asobeast/shared';

export class ReviewReplyDraftDto implements ReviewReplyDraftRequest {
  @ApiPropertyOptional({ enum: REVIEW_REPLY_TONES, default: 'neutral' })
  @IsOptional()
  @IsIn([...REVIEW_REPLY_TONES])
  tone?: ReviewReplyTone;

  @ApiPropertyOptional({ maxLength: REVIEW_REPLY_INSTRUCTIONS_MAX })
  @IsOptional()
  @IsString()
  @MaxLength(REVIEW_REPLY_INSTRUCTIONS_MAX)
  instructions?: string;
}
