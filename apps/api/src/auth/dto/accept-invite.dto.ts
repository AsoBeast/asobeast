import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { AcceptInviteRequest } from '@asobeast/shared';
import { IsPassword } from './password.decorator';

export class AcceptInviteDto implements AcceptInviteRequest {
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
