import { ChangePasswordRequest } from '@asobeast/shared';
import { IsString, MaxLength } from 'class-validator';
import { IsPassword } from './password.decorator';

export class ChangePasswordDto implements ChangePasswordRequest {
  @IsString()
  @MaxLength(128)
  current!: string;

  @IsPassword()
  next!: string;
}
