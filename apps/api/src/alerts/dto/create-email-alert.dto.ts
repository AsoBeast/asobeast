import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  ValidateIf,
} from 'class-validator';
import {
  EmailAlertCreateRequest,
  WEBHOOK_EVENTS,
  WebhookEvent,
} from '@asobeast/shared';
import { RankDropThresholdField } from './rank-drop-threshold.decorator';
import { RatingDropTenths } from './rating-drop-tenths.decorator';
import { ReviewScoresFilter } from './review-scores.decorator';

export class CreateEmailAlertDto implements EmailAlertCreateRequest {
  @IsEmail()
  email!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsIn(WEBHOOK_EVENTS, { each: true })
  events!: WebhookEvent[];

  @ReviewScoresFilter()
  reviewScores?: number[];
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  confirmDrops?: boolean;

  @RatingDropTenths()
  ratingDropTenths?: number;

  @RankDropThresholdField()
  rankDropThreshold?: number | null;
}
