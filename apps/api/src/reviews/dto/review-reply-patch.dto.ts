import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  REVIEW_REPLY_MAX_CHARS,
  type ReviewReplyPatchRequest,
} from '@asobeast/shared';

export class ReviewReplyPatchDto implements ReviewReplyPatchRequest {
  @ApiPropertyOptional({ maxLength: REVIEW_REPLY_MAX_CHARS })
  @IsOptional()
  @IsString()
  @MaxLength(REVIEW_REPLY_MAX_CHARS)
  text?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  replied?: boolean;
}
