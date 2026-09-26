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

export class UpdateEmailAlertDto implements EmailAlertUpdateRequest {
  @ValidateIf((_, value) => value !== undefined)
  @IsEmail()
  email?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(WEBHOOK_EVENTS, { each: true })
  events?: WebhookEvent[];

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  active?: boolean;
}
