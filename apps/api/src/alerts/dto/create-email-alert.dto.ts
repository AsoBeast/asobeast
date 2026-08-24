import { ArrayNotEmpty, IsArray, IsEmail, IsIn } from 'class-validator';
import {
  EmailAlertCreateRequest,
  WEBHOOK_EVENTS,
  WebhookEvent,
} from '@asobeast/shared';

export class CreateEmailAlertDto implements EmailAlertCreateRequest {
  @IsEmail()
  email!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsIn(WEBHOOK_EVENTS, { each: true })
  events!: WebhookEvent[];
}
