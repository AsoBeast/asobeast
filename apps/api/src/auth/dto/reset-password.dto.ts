import { IsString, MaxLength, MinLength } from 'class-validator';
import type { ResetPasswordRequest } from '@asobeast/shared';
import { IsPassword } from './password.decorator';
import { HashedOnly } from '../../common/validation/hashed-only.decorator';

export class ResetPasswordDto implements ResetPasswordRequest {
  @HashedOnly()
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  token!: string;

  @IsPassword()
  password!: string;
}
