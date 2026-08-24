import { LoginRequest } from '@asobeast/shared';
import { IsEmail, IsString, MaxLength } from 'class-validator';

export class LoginDto implements LoginRequest {
  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(128)
  password!: string;
}
