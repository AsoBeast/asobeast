import { ChangePasswordRequest } from '@asobeast/shared';
import { IsString, MaxLength } from 'class-validator';
import { IsPassword } from './password.decorator';
import { HashedOnly } from '../../common/validation/hashed-only.decorator';

export class ChangePasswordDto implements ChangePasswordRequest {
  @HashedOnly()
  @IsString()
  @MaxLength(128)
  current!: string;

  @IsPassword()
  next!: string;
}
