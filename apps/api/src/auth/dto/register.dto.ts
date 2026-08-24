import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { RegisterRequest } from '@asobeast/shared';

export class RegisterDto implements RegisterRequest {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}
