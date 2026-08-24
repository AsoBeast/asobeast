import { IsString, MaxLength, MinLength } from 'class-validator';
import type { VerifyEmailRequest } from '@asobeast/shared';

export class VerifyEmailDto implements VerifyEmailRequest {
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  token!: string;
}
