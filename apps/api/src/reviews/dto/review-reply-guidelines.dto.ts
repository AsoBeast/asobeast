import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import {
  REVIEW_REPLY_GUIDELINES_MAX,
  type ReviewReplyGuidelines,
} from '@asobeast/shared';

export class ReviewReplyGuidelinesDto implements ReviewReplyGuidelines {
  @ApiProperty({ maxLength: REVIEW_REPLY_GUIDELINES_MAX })
  @IsString()
  @MaxLength(REVIEW_REPLY_GUIDELINES_MAX)
  guidelines!: string;
}
