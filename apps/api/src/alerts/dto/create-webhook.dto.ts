import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';
import {
  WEBHOOK_EVENTS,
  WebhookCreateRequest,
  WebhookEvent,
} from '@asobeast/shared';
import { WEBHOOK_URL_OPTIONS } from './webhook-url-options';

export class CreateWebhookDto implements WebhookCreateRequest {
  @IsUrl(WEBHOOK_URL_OPTIONS)
  url!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsIn(WEBHOOK_EVENTS, { each: true })
  events!: WebhookEvent[];

  @IsOptional()
  @IsString()
  @MinLength(8)
  secret?: string;
}
