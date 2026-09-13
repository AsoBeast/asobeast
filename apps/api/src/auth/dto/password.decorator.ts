import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import {
  isPasswordAllowed,
  isPasswordLengthAllowed,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_RULE,
} from '@asobeast/shared';
import { IsString, MaxLength, MinLength, ValidateBy } from 'class-validator';

function meetsRuleWhenLengthIsAllowed(value: unknown): boolean {
  if (typeof value !== 'string' || !isPasswordLengthAllowed(value)) return true;
  return isPasswordAllowed(value);
}

export function IsPassword(): PropertyDecorator {
  return applyDecorators(
    ApiProperty({
      minLength: PASSWORD_MIN_LENGTH,
      maxLength: PASSWORD_MAX_LENGTH,
      description: PASSWORD_RULE,
    }),
    IsString(),
    MinLength(PASSWORD_MIN_LENGTH),
    MaxLength(PASSWORD_MAX_LENGTH),
    ValidateBy({
      name: 'isPassword',
      validator: {
        validate: meetsRuleWhenLengthIsAllowed,
        defaultMessage: () => PASSWORD_RULE,
      },
    }),
  );
}
