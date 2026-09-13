import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { RegisterRequest } from '@asobeast/shared';
import { IsPassword } from './password.decorator';

export class RegisterDto implements RegisterRequest {
  @IsEmail()
  email!: string;

  @IsPassword()
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}
