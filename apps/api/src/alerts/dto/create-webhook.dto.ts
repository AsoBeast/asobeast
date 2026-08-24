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

export class CreateWebhookDto implements WebhookCreateRequest {
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
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
