import {
  isPasswordAllowed,
  isPasswordLengthAllowed,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_RULE,
} from "@asobeast/shared";

export const PASSWORD_LENGTH_ERROR = `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters.`;

export function passwordError(password: string): string | null {
  if (isPasswordAllowed(password)) return null;
  return isPasswordLengthAllowed(password)
    ? PASSWORD_RULE
    : PASSWORD_LENGTH_ERROR;
}
