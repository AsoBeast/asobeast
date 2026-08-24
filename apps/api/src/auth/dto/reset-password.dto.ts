import { IsString, MaxLength, MinLength } from 'class-validator';
import type { ResetPasswordRequest } from '@asobeast/shared';

export class ResetPasswordDto implements ResetPasswordRequest {
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  token!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(128)
  password!: string;
}
