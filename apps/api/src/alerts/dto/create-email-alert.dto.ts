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

export class CreateEmailAlertDto implements EmailAlertCreateRequest {
  @IsEmail()
  email!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsIn(WEBHOOK_EVENTS, { each: true })
  events!: WebhookEvent[];

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  confirmDrops?: boolean;
}
