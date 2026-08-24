import { IsEmail, MaxLength } from 'class-validator';
import type { RequestPasswordResetRequest } from '@asobeast/shared';

const EMAIL_MAX = 320;

export class RequestPasswordResetDto implements RequestPasswordResetRequest {
  @IsEmail()
  @MaxLength(EMAIL_MAX)
  email!: string;
}
