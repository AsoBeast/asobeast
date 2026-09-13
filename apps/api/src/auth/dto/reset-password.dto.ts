import { IsString, MaxLength, MinLength } from 'class-validator';
import type { ResetPasswordRequest } from '@asobeast/shared';
import { IsPassword } from './password.decorator';

export class ResetPasswordDto implements ResetPasswordRequest {
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  token!: string;

  @IsPassword()
  password!: string;
}
