import { LoginRequest } from '@asobeast/shared';
import { IsEmail, IsString, MaxLength } from 'class-validator';
import { HashedOnly } from '../../common/validation/hashed-only.decorator';

export class LoginDto implements LoginRequest {
  @IsEmail()
  email!: string;

  @HashedOnly()
  @IsString()
  @MaxLength(128)
  password!: string;
}
