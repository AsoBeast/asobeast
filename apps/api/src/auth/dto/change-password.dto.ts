import { ChangePasswordRequest } from '@asobeast/shared';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto implements ChangePasswordRequest {
  @IsString()
  @MaxLength(128)
  current!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(128)
  next!: string;
}
