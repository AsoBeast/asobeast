import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  WEBHOOK_EVENTS,
  WebhookCreateRequest,
  WebhookEvent,
} from '@asobeast/shared';
import { RankDropThresholdField } from './rank-drop-threshold.decorator';
import { RatingDropTenths } from './rating-drop-tenths.decorator';
import { ReviewScoresFilter } from './review-scores.decorator';
import { WEBHOOK_URL_OPTIONS } from './webhook-url-options';

export class CreateWebhookDto implements WebhookCreateRequest {
  @IsUrl(WEBHOOK_URL_OPTIONS)
  url!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsIn(WEBHOOK_EVENTS, { each: true })
  events!: WebhookEvent[];

  @ReviewScoresFilter()
  reviewScores?: number[];

  @IsOptional()
  @IsString()
  @MinLength(8)
  secret?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  confirmDrops?: boolean;

  @RatingDropTenths()
  ratingDropTenths?: number;

  @RankDropThresholdField()
  rankDropThreshold?: number | null;
}
