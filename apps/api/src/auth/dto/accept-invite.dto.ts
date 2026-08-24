import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { AcceptInviteRequest } from '@asobeast/shared';

export class AcceptInviteDto implements AcceptInviteRequest {
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  token!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}
