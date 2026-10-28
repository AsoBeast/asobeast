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
  WebhookEvent,
  WebhookUpdateRequest,
} from '@asobeast/shared';
import { ReviewScoresFilter } from './review-scores.decorator';
import { WEBHOOK_URL_OPTIONS } from './webhook-url-options';

export class UpdateWebhookDto implements WebhookUpdateRequest {
  @ValidateIf((_, value) => value !== undefined)
  @IsUrl(WEBHOOK_URL_OPTIONS)
  url?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(WEBHOOK_EVENTS, { each: true })
  events?: WebhookEvent[];

  @ReviewScoresFilter()
  reviewScores?: number[];

  @IsOptional()
  @ValidateIf((dto: UpdateWebhookDto) => dto.secret !== '')
  @IsString()
  @MinLength(8)
  secret?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  active?: boolean;
}
