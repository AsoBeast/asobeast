import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  ValidateIf,
} from 'class-validator';
import {
  EmailAlertUpdateRequest,
  WEBHOOK_EVENTS,
  WebhookEvent,
} from '@asobeast/shared';
import { ReviewScoresFilter } from './review-scores.decorator';

export class UpdateEmailAlertDto implements EmailAlertUpdateRequest {
  @ValidateIf((_, value) => value !== undefined)
  @IsEmail()
  email?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(WEBHOOK_EVENTS, { each: true })
  events?: WebhookEvent[];

  @ReviewScoresFilter()
  reviewScores?: number[];

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  active?: boolean;
}
