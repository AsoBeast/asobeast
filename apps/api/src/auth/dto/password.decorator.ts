import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_RULE,
} from '@asobeast/shared';
import { IsString, MaxLength, MinLength, ValidateBy } from 'class-validator';

const WHITESPACE = /\s/g;

function characterCount(text: string): number {
  return [...text].length;
}

function hasEnoughNonWhitespaceCharacters(value: unknown): boolean {
  if (typeof value !== 'string') return true;
  const length = characterCount(value);
  if (length < PASSWORD_MIN_LENGTH || length > PASSWORD_MAX_LENGTH) return true;
  return characterCount(value.replace(WHITESPACE, '')) >= PASSWORD_MIN_LENGTH;
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
        validate: hasEnoughNonWhitespaceCharacters,
        defaultMessage: () => PASSWORD_RULE,
      },
    }),
  );
}
