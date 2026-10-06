import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { AcceptInviteRequest } from '@asobeast/shared';
import { IsPassword } from './password.decorator';
import { HashedOnly } from '../../common/validation/hashed-only.decorator';

export class AcceptInviteDto implements AcceptInviteRequest {
  @HashedOnly()
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  token!: string;

  @IsPassword()
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}
