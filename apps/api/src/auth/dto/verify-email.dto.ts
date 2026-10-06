import { IsString, MaxLength, MinLength } from 'class-validator';
import type { VerifyEmailRequest } from '@asobeast/shared';
import { HashedOnly } from '../../common/validation/hashed-only.decorator';

export class VerifyEmailDto implements VerifyEmailRequest {
  @HashedOnly()
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  token!: string;
}
